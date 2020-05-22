import { importHtml, importOnCall, importRef, initMsaBox, Q, ajax } from "/utils/msa-utils.js"
import { prettyFormatDate } from "/utils/msa-utils-date.js"

async function getUser() {
	const mod = await import("/user/msa-user-utils.js")
	return await mod.getUser()
}

const popupSrc = "/utils/msa-utils-popup.js"
const addPopup = importOnCall(popupSrc, "addPopup")
const addConfirmPopup = importOnCall(popupSrc, "addConfirmPopup")
const addErrorPopup = importOnCall(popupSrc, "addErrorPopup")
const textEditorSrc = "/utils/msa-utils-text-editor.js"
const makeTextEditable = importOnCall(textEditorSrc, "makeTextEditable")


importHtml(`<style>

	msa-chat {
		padding: 1em;
	}

	msa-chat .row {
		display: flex;
		flex-direction: row;
	}
	msa-chat .col {
		display: flex;
		flex-direction: column;
	}
	msa-chat .fill {
		flex: 1;
	}

	msa-chat .admin input[type=image] {
		background: white;
		width: 2em;
		height: 2em;
		padding: .4em;
		margin-left: .5em;
		background: white;
		border-radius: .5em;
		box-shadow: 2px 2px 4px #555;
	}
	msa-chat .admin input[type=image]:hover {
		background: lightgrey;
	}

	msa-chat .user_name {
		width: 8em;
	}

	msa-chat .messages {
		padding: .5em;
	}

	msa-chat .message {
		border-top: 1px dashed lightgrey;
		padding: .3em;
	}

	msa-chat .meta1 {
		font-weight: bold;
	}

	msa-chat .meta2 {
		font-style: italic;
		color: grey;
		font-size: .8em;
	}

	msa-chat .message .content {
		margin: .4em;
	}

	msa-chat .message .btns {
		display: flex;
	}
	msa-chat .message .btns input[type=image] {
		width: 1.2em;
		height: 1.2em;
		padding: .3em;
	}
	msa-chat .message .btns input[type=image]:hover {
		box-shadow: 2px 2px 4px #555;
	}
</style>`)

const template = `
	<div class="admin row" style="display:none">
		<input type="image" class="config" src="/utils/img/config">
	</div>
	<div class="chat col">
		<div class="messages col"></div>
		<div class="load_chat" style="text-align:center"><msa-loader></msa-loader></div>
		<div class="row">
			<input class="user_name" placeholder="Your name">
			<input class="add_message fill" placeholder="Type message here...">
			<button class="add_box">Add box</button>
		</div>
	</p>`

const msgTemplate = `
	<div class="message row">
		<div class="row fill">
			<div class="col fill">
				<div class="meta">
					<span class="createdBy meta1"></span> <span class="createdAt meta2"></span>
					<span class="updatedBy meta2"></span> <span class="updatedAt meta2"></span>
				</div>
				<div class="content" style="min-height:1em"></div>
			</div>
			<div class="btns row">
				<input type="image" class="edit" src="/utils/img/edit">
				<input type="image" class="rm" src="/utils/img/remove">
				<input type="image" class="suggest" src="/utils/img/add">
				<input type="image" class="save editing" src="/utils/img/save">
				<input type="image" class="cancel editing" src="/utils/img/cancel">
			</div>
		</div>
	</div>`

export class HTMLMsaChatElement extends HTMLElement {

	connectedCallback() {
		this.messages = []
		this.Q = Q
		this.baseUrl = this.getAttribute("base-url")
		this.chatId = this.getAttribute("chat-id")
		this.initContent()
		this.initActions()
		//this.initIntro()
		this.getChat()
	}

	getTemplate() { return template }
	getMessageTemplate() { return msgTemplate }

	async initContent() {
		this.innerHTML = this.getTemplate()
		const user = await getUser()
		showEl(this.querySelector(".user_name"), !user)
	}

	initActions() {
		this.Q(".config").onclick = () => this.popupConfig()
		//if (this.canEdit) {
		if (true) {
			const addMsgEl = this.querySelector(".add_message")
			addMsgEl.onkeydown = async evt => {
				if (evt.keyCode === 13) { // ENTER
					if (await this.postMessage({ content: addMsgEl.value }))
						addMsgEl.value = ""
				}
			}

			const addBoxEl = this.querySelector(".add_box")
			addBoxEl.onclick = async () => {
				await import("/utils/msa-utils-boxes-menu.js")
				const popup = await addPopup(this, document.createElement("msa-utils-boxes-menu"))
				popup.content.onSelect = async boxInfo => {
					popup.remove()
					const createFun = await importRef(boxInfo.createRef)
					const box = await createFun(this)
					this.postMessage({ content: box.outerHTML })
				}
			}
		}
	}

	getChat() {
		ajax("GET", `${this.baseUrl}/${this.chatId}/_list`,
			{ loadingDom: this.Q(".load_chat") })
			.then(({ messages, canAdmin, canCreateMessage }) => {
				this.initAdmin(canAdmin)
				this.initCreateMessage(canCreateMessage)
				//this.initVotes(votes)
				this.addMessages(messages)
			})
	}

	initAdmin(canAdmin) {
		this.Q(".admin").style.display = canAdmin ? "" : "none"
	}

	initCreateMessage(canCreateMessage) {
		this.canCreateMessage = canCreateMessage
		//showEl(this.Q(".new_idea"), canCreateMessage)
	}

	addMessages(newMsgs) {
		const msgsEl = this.querySelector(".messages")
		const msgs = this.messages
		let prevMsg
		for (let msg of newMsgs) {
			const ite = uniqueOrderedInsert(msgs, msg, (a, b) => b.num - a.num)
			if (ite >= 0) {
				const el = this.createMessage(msg, prevMsg)
				msg.el = el
				if (ite === msgs.length - 1)
					msgsEl.appendChild(el)
				else
					msgsEl.insertBefore(el, msgs[ite + 1].el)
			}
			prevMsg = msg
		}
	}

	createMessage(msg, prevMsg) {
		msg = msg || {}
		const msgEl = toEls(this.getMessageTemplate())[0]
		msgEl.message = msg
		// actions
		//msgEl.querySelector("input.suggest").onclick = () => this.showNewSuggestion(msgEl, true)
		if (msg.canEdit) {
			msgEl.querySelector("input.edit").onclick = () => {
				makeTextEditable(msgEl.querySelector(".content"))
				msg.editing = true
				this.syncMessage(msgEl)
			}
			msgEl.querySelector("input.save").onclick = () => {
				const content = msgEl.querySelector(".content")
				makeTextEditable(content, false)
				msg.content = content.innerHTML
				this.postMessage(msg)
				msg.editing = false
				this.syncMessage(msgEl)
				if (msgEl.onEditEnd) msgEl.onEditEnd()
			}
			msgEl.querySelector("input.cancel").onclick = () => {
				makeTextEditable(msgEl.querySelector(".content"), false)
				msg.editing = false
				this.syncMessage(msgEl)
				if (msgEl.onEditEnd) msgEl.onEditEnd()
			}
		}
		if (msg.canRemove) {
			msgEl.querySelector("input.rm").onclick = () => {
				addConfirmPopup(this, "Are you sur to remove this message ?")
					.then(() => {
						ajax("DELETE", `${this.baseUrl}/${this.chatId}/_message/${msg.num}`)
							.then(() => msgEl.remove())
					})
			}
		}
		// sync
		this.syncMessage(msgEl, prevMsg)
		return msgEl
	}

	/*
		makeMessageEditable(msgEl) {
			const idea = ideaEl.idea
			makeTextEditable(ideaEl.querySelector(".content"))
			idea.editing = true
			this.syncIdea(ideaEl)
		}
	*/

	async syncMessage(msgEl, prevMsg) {
		const msg = msgEl.message
		// msgEl.querySelector(".content").innerHTML = msg.content || ""
		const cntEl = msgEl.querySelector(".content")
		const cntEls = toEls(msg.content || "")
		await initMsaBox(cntEls, { boxesRoute: `${this.baseUrl}/${this.chatId}/_box` })
		for (let i = 0, len = cntEls.length; i < len; ++i) cntEl.appendChild(cntEls[i])
		if (msg.createdBy) {
			if (msg.createdBy != (prevMsg && prevMsg.createdBy))
				msgEl.querySelector(".meta .createdBy").textContent = `${msg.createdBy}:`
			const prettyCreatedAt = prettyFormatDate(new Date(msg.createdAt))
			const prettyPrevCreatedAt = prevMsg && prettyFormatDate(new Date(prevMsg.createdAt))
			if (prettyCreatedAt != prettyPrevCreatedAt)
				msgEl.querySelector(".meta .createdAt").textContent = prettyFormatDate(new Date(msg.createdAt))
			if (msg.createdAt !== msg.updatedAt) {
				let updatedTxt = "Updated"
				if (msg.createdBy !== msg.updatedBy)
					updatedTxt += ` by ${msg.updatedBy}`
				msgEl.querySelector(".meta .updatedBy").textContent = updatedTxt
				msgEl.querySelector(".meta .updatedAt").textContent = prettyFormatDate(new Date(msg.updatedAt))
			}
		}
		showEl(msgEl.querySelector("input.edit"), msg.canEdit && !msg.editing)
		showEl(msgEl.querySelector("input.rm"), msg.canRemove && !msg.editing)
		showEl(msgEl.querySelector("input.suggest"), this.canCreateIdea && !msg.editing)
		showEl(msgEl.querySelector("input.save"), msg.editing)
		showEl(msgEl.querySelector("input.cancel"), msg.editing)
	}

	/*
		showNewIdea(val) {
			const newIdeaInput = this.Q(".new_idea input")
			showEl(newIdeaInput, !val)
			const newIdeaEl = this.querySelector(".ideas .new")
			if (val && !newIdeaEl) {
				const idea = { canEdit: true }
				const ideaEl = this.createIdea(idea)
				ideaEl.classList.add("new")
				ideaEl.onEditEnd = () => this.showNewIdea(false)
				prependChild(this.Q(".ideas"), ideaEl)
				this.makeIdeaEditable(ideaEl)
			}
			if (!val && newIdeaEl) newIdeaEl.remove()
		}
	*/
	/*
	showNewSuggestion(parentIdeaEl, val) {
		const suggestInput = parentIdeaEl.querySelector("input.suggest")
		showEl(suggestInput, !val)
		const newSuggestEl = parentIdeaEl.newSuggestEl
		if (val && !newSuggestEl) {
			const idea = { canEdit: true, parent: parentIdeaEl.idea.num }
			const ideaEl = this.createIdea(idea, parentIdeaEl.ideaTab + 1)
			parentIdeaEl.newSuggestEl = ideaEl
			ideaEl.onEditEnd = () => this.showNewSuggestion(parentIdeaEl, false)
			this.querySelector(".ideas").insertBefore(ideaEl, parentIdeaEl.nextSibling)
			this.makeIdeaEditable(ideaEl)
		}
		if (!val && newSuggestEl) {
			newSuggestEl.remove()
			delete parentIdeaEl.newSuggestEl
		}
	}
	*/

	async postMessage(msg) {
		let path = `${this.baseUrl}/${this.chatId}/_message`
		if (msg.num !== undefined)
			path += `/${msg.num}`
		const body = { parent: msg.parent, content: msg.content }
		if (!await getUser()) {
			const by = this.querySelector(".user_name").value
			if (!by) {
				addErrorPopup(this, "You must provide an user name")
				return false
			}
			body["by"] = by
		}
		await ajax("POST", path, { body })
		this.getChat()
		return true
	}

	popupConfig() {
		import("/params/msa-params-admin.js")
		const paramsEl = document.createElement("msa-params-admin")
		paramsEl.setAttribute("base-url", `${this.baseUrl}/_params/${this.chatId}`)
		addPopup(this, paramsEl)
	}
}

customElements.define("msa-chat", HTMLMsaChatElement)

// utils

function toEls(html) {
	const t = document.createElement("template")
	t.innerHTML = html.trim()
	return t.content.childNodes
}

function initArr(obj, key) {
	let arr = obj[key]
	if (arr === undefined) arr = obj[key] = []
	return arr
}

function initObj(obj, key) {
	let arr = obj[key]
	if (arr === undefined) arr = obj[key] = {}
	return arr
}

function showEl(el, val) {
	el.style.display = val ? "" : "none"
}

function prependChild(parent, el) {
	const children = parent.children
	if (children.length === 0)
		parent.appendChild(el)
	else
		parent.insertBefore(el, children[0])
}

function uniqueOrderedInsert(arr, item, comparator) {
	for (let i = 0, len = arr.length; i < len; i++) {
		const c = comparator(item, arr[i])
		if (c === 0) return -1
		if (c > 0) {
			arr.splice(i, 0, item)
			return i
		}
	}
	arr.push(item)
	return arr.length - 1
}