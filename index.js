const { formatHtml, useMsaBoxesRouter, registerMsaBox } = Msa.require('utils')
const { db } = Msa.require("db")
const { Chat, ChatMessage } = require('./model')
const userMdw = Msa.require("user/mdw")

const { ChatPerm } = require("./perm")
const { addChatGlobalParams } = require("./params")
const { MsaParamsLocalAdminModule } = Msa.require("params")

class MsaChatModule extends Msa.Module {

	constructor() {
		super()
		this.initApp()
		this.initParams()
	}

	getId(req, reqId) {
		return `chat-${reqId}`
	}

	getUserId(req) {
		const user = req.user
		return user ? user.id : req.connection.remoteAddress
	}

	getUserName(req, reqUserName) {
		const user = req.user
		return user ? user.name : reqUserName
	}

	checkPerm(req, chat, permId, expVal, prevVal) {
		const perm = chat.params[permId].get()
		return perm.check(req.user, expVal, prevVal)
	}

	canRead(req, chat) {
		return this.checkPerm(req, chat, "perm", ChatPerm.READ)
	}

	canCreateMessage(req, chat) {
		return this.checkPerm(req, chat, "perm", ChatPerm.PROPOSE)
	}

	canAdmin(req, chat) {
		return this.checkPerm(req, chat, "perm", ChatPerm.ADMIN)
	}

	canReadMessage(req, chat, msg) {
		return this.checkPerm(req, chat, "perm", ChatPerm.READ)
			|| (msg.createdById == this.getUserId(req))
	}

	canWriteMessage(req, chat, msg) {
		return this.checkPerm(req, chat, "perm", ChatPerm.ADMIN)
			|| (msg.createdById == this.getUserId(req))
	}

	canRemoveMessage(req, chat, msg) {
		return this.checkPerm(req, chat, "perm", ChatPerm.ADMIN)
			|| (msg.createdById == this.getUserId(req))
	}

	initApp() {
		const app = this.app

		// get page
		app.get("/:id", (req, res, next) => {
			try {
				const id = req.params.id
				if (id.indexOf('-') >= 0 || id[0] === '_')
					return next()
				res.sendPage({
					wel: "/msa/chat/msa-chat.js",
					attrs: {
						'base-url': req.baseUrl,
						'chat-id': id
					}
				})
			} catch(err) { next(err) }
		})

		// list chat
		app.get("/:id/_list", userMdw, async (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id)
				const chat = await this.getChat(req, id)
				const msgs = await this.getMessages(req, chat)
				// vote
				/*
				const chatIds = chat.map(idea => `${idea.id}-${idea.num}`)
				this.setReqVoteArgs(req, ideaSet)
				const votes = await this.vote.getVoteSets(ctx, chatIds)
				*/
				// res
				res.json({
					messages: msgs.map(m => this.exportMessage(req, chat, m)),
					canAdmin: this.canAdmin(req, chat),
					canCreateMessage: this.canCreateMessage(req, chat)
				})
			} catch(err) { next(err) }
		})

		// post new chat
		app.post("/", userMdw, async (req, res, next) => {
			try {
				const chat = await this.createNewChat(req)
				res.json({
					id: chat.id
				})
			} catch(err) { next(err) }
		})

		// post new message
		app.post("/:id/_message", userMdw, async (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id)
				const { content, by } = req.body
				const chat = await this.getChat(req, id)
				await this.createMessage(req, chat, content, { by })
				res.sendStatus(Msa.OK)
			} catch(err) { next(err) }
		})

		// post existing message
		app.post("/:id/_message/:num", userMdw, async (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id),
					num = req.params.num
				const { content, by } = req.body
				const chat = await this.getChat(req, id)
				await this.updateMessage(req, chat, num, content, { by })
				res.sendStatus(Msa.OK)
			} catch(err) { next(err) }
		})

		// delete idea
		app.delete("/:id/_message/:num", userMdw, async (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id),
					num = req.params.num
				const chat = await this.getChat(req, id)
				const msg = await this.getMessage(req, chat, num)
				// TODO: not found
				await this.removeMessage(req, chat, msg)
				res.sendStatus(Msa.OK)
			} catch(err) { next(err) }
		})

		// MSA boxes
		useMsaBoxesRouter(app, '/:id/_box', req => ({ parentId: this.getId(req, req.params.id) }))
	}

	async getChat(req, id) {
		const dbChat = await db.collection("msa_chats").findOne({ _id:id })
		const chat = Chat.newFromDb(id, dbChat)
		if (!this.canRead(req, chat)) throw Msa.FORBIDDEN
		return chat
	}

	async getMessages(req, chat) {
		const dbMsgs = await db.collection("msa_chat_messages").find({ _id:new RegExp('^' + chat.id) }).toArray()
		const msgs = dbMsgs
			.map(dbMsg => ChatMessage.newFromDb(dbMsg.chatId, dbMsg.num, dbMsg))
			.filter(msg => this.canReadMessage(req, chat, msg))
		return msgs
	}

	async getMessage(req, chat, num) {
		const dbMsg = await db.collection("msa_chat_messages").findOne({ _id:`${chat.id}-${num}` })
		const msg = ChatMessage.newFromDb(chat.id, num, dbMsg)
		if (!this.canRead(req, chat, msg)) throw Msa.FORBIDDEN
		return msg
	}

	async createNewChat(req) {
		const id = this.getId(req, "")
		const newId = await dbCounterIncr("msa_chats_counter", id)
		const chat = new Chat(this.getId(req, newId))
		return chat
	}

	async createMessage(req, chat, content, kwargs) {
		if (!this.canCreateMessage(req, chat)) throw Msa.FORBIDDEN
		const id = this.getId(req, chat.id)
		const num = await dbCounterIncr("msa_chat_messages_counter", id)
		const msg = new ChatMessage(chat.id, num)
		msg.content = formatHtml(content).body
		msg.parent = kwargs && kwargs.parent
		msg.createdById = this.getUserId(req)
		msg.createdBy = msg.updatedBy = this.getUserName(req, kwargs && kwargs.by)
		msg.createdAt = msg.updatedAt = new Date(Date.now())
		const vals = msg.formatForDb()
		await db.collection("msa_chat_messages").updateOne(
			{ _id: vals._id },
			{ $set: vals },
			{ upsert: true }
		)
		return msg
	}

	async updateMessage(req, chat, num, content, kwargs) {
		const msg = await this.getMessage(req, chat, num)
		// TODO: not found
		if (!this.canWriteMessage(req, chat, msg)) throw Msa.FORBIDDEN
		msg.content = formatHtml(content).body
		msg.updatedBy = this.getUserName(req, kwargs && kwargs.by)
		msg.updatedAt = new Date(Date.now())
		const vals = msg.formatForDb()
		await db.collection("msa_chat_messages").updateOne(
			{ _id: vals._id },
			{ $set: vals }
		)
	}

	async removeMessage(req, chat, msg) {
		if (!this.canRemoveMessage(req, chat, msg)) throw Msa.FORBIDDEN
		const vals = msg.formatForDb()
		await db.collection("msa_chat_messages").deleteOne(
			{ _id: vals._id }
		)
	}

	exportMessage(req, chat, msg) {
		return {
			id: msg.chatId,
			num: msg.num,
			content: msg.content,
			parent: msg.parent,
			createdBy: msg.createdBy,
			updatedBy: msg.updatedBy,
			createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
			updatedAt: msg.updatedAt ? msg.updatedAt.toISOString() : null,
			canEdit: this.canWriteMessage(req, chat, msg),
			canRemove: this.canRemoveMessage(req, chat, msg)
		}
	}

	// params

	initParams() {

		this.params = new class extends MsaParamsLocalAdminModule {

			async getRootParam(ctx) {
				const id = ctx.chatParamsArgs.id
				const dbRow = await ctx.db.getOne("SELECT params FROM msa_chats WHERE id=:id",
					{ id })
				return Chat.newFromDb(id, dbRow).params
			}

			async updateRootParam(ctx, rootParam) {
				const vals = {
					id: ctx.chatParamsArgs.id,
					params: rootParam.getAsDbStr()
				}
				const res = await ctx.db.run("UPDATE msa_chats SET params=:params WHERE id=:id", vals)
				if (res.nbChanges === 0)
					await ctx.db.run("INSERT INTO msa_chats (id, params) VALUES (:id, :params)", vals)
			}
		}

		this.app.use("/_params/:id", (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id)
				req.chatParamsArgs = { id }
				next()
			} catch (err) { next(err) }
		}, this.params.app)
	}
}


// box

class MsaChatBoxModule extends MsaChatModule {
	getId(req, reqId) {
		return `${req.msaBoxCtx.parentId}-${reqId}`
	}
}

registerMsaBox("msa-chat-box", {
	title: "Chat",
	mods: { "/chat": new MsaChatBoxModule() },
	head: "/msa/chat/msa-chat.js"
})

// utils

async function dbCounterIncr(name, id) {
	const res = await db.collection(name).findOneAndUpdate(
		{ _id: id },
		{
			$set: { _id: id },
			$inc: { value: 1 }
		},
		{
			upsert: true,
			new: true
		}
	)
	return res.value ? res.value.value : 0
}

// export
module.exports = {
	installMsaModule: async itf => {
		await require("./install")(itf)
	},
	startMsaModule: () => {
		addChatGlobalParams()
		return new MsaChatModule()
	},
	MsaChatModule
}
