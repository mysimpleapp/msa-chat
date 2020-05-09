const { withDb } = Msa.require('db')
const { Chat, ChatTopic, ChatMessage } = require('./model')
const userMdw = Msa.require("user/mdw")

const { ChatPerm } = require("./perm")
const { MsaParamsLocalAdminModule } = Msa.require("params")

class MsaChatModule extends Msa.Module {

	constructor() {
		super()
		this.initApp()
		this.initParams()
	}

	getId(ctx, reqId) {
		return `chat-${reqId}`
	}

	getUserId(ctx) {
		const user = ctx.user
		return user ? user.id : ctx.connection.remoteAddress
	}

	getUserName(ctx, reqUserName) {
		const user = ctx.user
		return user ? user.name : reqUserName
	}

	checkPerm(ctx, chat, permId, expVal, prevVal) {
		const perm = chat.params[permId].get()
		return perm.check(ctx.user, expVal, prevVal)
	}

	canRead(ctx, chat) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.READ)
	}

	canCreateMessage(ctx, chat) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.PROPOSE)
	}

	canAdmin(ctx, chat) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.ADMIN)
	}

	canReadMessage(ctx, chat, msg) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.READ)
			|| (msg.createdById == this.getUserId(ctx))
	}

	canWriteMessage(ctx, chat, msg) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.ADMIN)
			|| (msg.createdById == this.getUserId(ctx))
	}

	canRemoveMessage(ctx, chat, msg) {
		return this.checkPerm(ctx, chat, "perm", ChatPerm.ADMIN)
			|| (msg.createdById == this.getUserId(ctx))
	}

	initApp() {
		const app = this.app
		// get page
		app.get("/:id", (req, res, next) => {
			const id = req.params.id
			if (id.indexOf('-') >= 0 || id[0] === '_')
				return next()
			res.sendPage({
				wel: "/chat/msa-chat.js",
				attrs: {
					'base-url': req.baseUrl,
					'chat-id': id
				}
			})
		})

		// list chat
		app.get("/:id/_list", userMdw, (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const chat = await this.getChat(ctx, id)
				const msgs = await this.getMessages(ctx, chat)
				// vote
				/*
				const chatIds = chat.map(idea => `${idea.id}-${idea.num}`)
				this.setReqVoteArgs(req, ideaSet)
				const votes = await this.vote.getVoteSets(ctx, chatIds)
				*/
				// res
				res.json({
					messages: msgs.map(m => this.exportMessage(ctx, chat, m)),
					canAdmin: this.canAdmin(ctx, chat),
					canCreateMessage: this.canCreateMessage(ctx, chat)
				})
			}).catch(next)
		})

		// post new idea
		app.post("/:id/_message", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const { content, by } = req.body
				const chat = await this.getChat(ctx, id)
				await this.createMessage(ctx, chat, content, { by })
				res.sendStatus(Msa.OK)
			}).catch(next)
		})

		// post existing idea
		app.post("/:id/_message/:num", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id),
					num = req.params.num
				const { content, by } = req.body
				const chat = await this.getChat(ctx, id)
				await this.updateMessage(ctx, chat, num, content, { by })
				res.sendStatus(Msa.OK)
			}).catch(next)
		})

		// delete idea
		app.delete("/:id/_message/:num", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id),
					num = req.params.num
				const chat = await this.getChat(ctx, id)
				const msg = await this.getMessage(ctx, chat, num)
				// TODO: not found
				await this.removeMessage(ctx, chat, msg)
				res.sendStatus(Msa.OK)
			}).catch(next)
		})
	}

	async getChat(ctx, id) {
		const dbChat = await ctx.db.getOne("SELECT id, params FROM msa_chats WHERE id=:id", { id })
		const chat = Chat.newFromDb(id, dbChat)
		if (!this.canRead(ctx, chat)) throw Msa.FORBIDDEN
		return chat
	}

	async getMessages(ctx, chat) {
		const dbMsgs = await ctx.db.get("SELECT id, num, parent, content, createdById, createdBy, updatedBy, createdAt, updatedAt FROM msa_chat_messages WHERE id=:id",
			{ id: chat.id })
		const msgs = dbMsgs
			.map(dbMsg => ChatMessage.newFromDb(dbMsg.id, dbMsg.num, dbMsg))
			.filter(msg => this.canReadMessage(ctx, chat, msg))
		return msgs
	}

	async getMessage(ctx, chat, num) {
		const dbMsg = await ctx.db.getOne("SELECT id, num, parent, content, createdById, createdBy, updatedBy, createdAt, updatedAt FROM msa_chat_messages WHERE id=:id AND num=:num",
			{ id: chat.id, num })
		const msg = ChatMessage.newFromDb(chat.id, num, dbMsg)
		if (!this.canRead(ctx, chat, msg)) throw Msa.FORBIDDEN
		return msg
	}

	async createMessage(ctx, chat, content, kwargs) {
		if (!this.canCreateMessage(ctx, chat)) throw Msa.FORBIDDEN
		const id = chat.id
		const res = await ctx.db.getOne("SELECT MAX(num) AS max_num FROM msa_chat_messages WHERE id=:id", { id })
		const num = (res && typeof res.max_num === "number") ? (res.max_num + 1) : 0
		const msg = new ChatMessage(id, num)
		msg.content = content
		msg.parent = kwargs && kwargs.parent
		msg.createdById = this.getUserId(ctx)
		msg.createdBy = msg.updatedBy = this.getUserName(ctx, kwargs && kwargs.by)
		msg.createdAt = msg.updatedAt = new Date(Date.now())
		await ctx.db.run("INSERT INTO msa_chat_messages (id, num, content, parent, createdById, createdBy, updatedBy, createdAt, updatedAt) VALUES (:id, :num, :content, :parent, :createdById, :createdBy, :updatedBy, :createdAt, :updatedAt)",
			msg.formatForDb())
		return msg
	}

	async updateMessage(ctx, chat, num, content, kwargs) {
		const msg = await this.getMessage(ctx, chat, num)
		// TODO: not found
		if (!this.canWriteMessage(ctx, chat, msg)) throw Msa.FORBIDDEN
		msg.content = content
		msg.updatedBy = this.getUserName(ctx, kwargs && kwargs.by)
		msg.updatedAt = new Date(Date.now())
		await ctx.db.run("UPDATE msa_chat_messages SET content=:content, updatedBy=:updatedBy, updatedAt=:updatedAt WHERE id=:id AND num=:num",
			msg.formatForDb(["id", "num", "content", "updatedBy", "updatedAt"]))
	}

	async removeMessage(ctx, chat, msg) {
		if (!this.canRemoveMessage(ctx, chat, msg)) throw Msa.FORBIDDEN
		await ctx.db.run("DELETE FROM msa_chat_messages WHERE id=:id AND num=:num",
			{ id: chat.id, num: msg.num })
	}

	exportMessage(ctx, chat, msg) {
		return {
			id: msg.id,
			num: msg.num,
			content: msg.content,
			parent: msg.parent,
			createdBy: msg.createdBy,
			updatedBy: msg.updatedBy,
			createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
			updatedAt: msg.updatedAt ? msg.updatedAt.toISOString() : null,
			canEdit: this.canWriteMessage(ctx, chat, msg),
			canRemove: this.canRemoveMessage(ctx, chat, msg)
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


// sheet box

class MsaChatSheetBoxModule extends MsaChatModule {
	getId(ctx, reqId) {
		const sheetId = ctx.msaSheetArgs.id
		return `chat-${sheetId}-${reqId}`
	}
}

const { registerSheetBoxTemplate } = Msa.require("sheet")

registerSheetBoxTemplate("msa-chat", {
	title: "Chat",
	editionSrc: "/chat/msa-chat-sheet-box.js",
	mods: { "/chat": new MsaChatSheetBoxModule() }
})

// utils

function newCtx(req, kwargs) {
	const ctx = Object.create(req)
	Object.assign(ctx, kwargs)
	return ctx
}

// export
const exp = module.exports = new MsaChatModule()
exp.MsaChatModule = MsaChatModule
