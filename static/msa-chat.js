import { importHtml, importOnCall, Q, ajax } from "/utils/msa-utils.js"
import { prettyFormatDate } from "/utils/msa-utils-date.js"
// import "/sheet/msa-sheet.js"
// import "/vote/msa-vote.js"

let User
import("/user/msa-user-utils.js").then(async mod => {
	User = await mod.getUser()
})

const popupSrc = "/utils/msa-utils-popup.js"
const addPopup = importOnCall(popupSrc, "addPopup")
const addConfirmPopup = importOnCall(popupSrc, "addConfirmPopup")
const addInputPopup = importOnCall(popupSrc, "addInputPopup")
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

	msa-chat .messages {
		padding: .5em;
		/* align-items: stretch; */
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
	<h1>Chat</h1>
	<div class="admin row" style="display:none">
		<input type="image" class="config" src="/utils/img/config">
	</div>
	<div class="chat col">
		<div class="messages col"></div>
		<div class="load_chat" style="text-align:center"><msa-loader></msa-loader></div>
		<div><input class="new_message" style="width:100%" placeholder="Type message here..."></div>
	</p>`

const msgTemplate = `
	<div class="message row">
		<div class="fill col">
			<div class="row">
				<div class="meta fill">
					<span class="createdBy meta1"></span> <span class="createdAt meta2"></span>
					<span class="updatedBy meta2"></span> <span class="updatedAt meta2"></span>
				</div>
				<div class="btns">
					<input type="image" class="edit" src="/utils/img/edit">
					<input type="image" class="rm" src="/utils/img/remove">
					<input type="image" class="suggest" src="/utils/img/add">
					<input type="image" class="save editing" src="/utils/img/save">
					<input type="image" class="cancel editing" src="/utils/img/cancel">
				</div>
			</div>
			<div class="content fill" style="min-height:1em"></div>
		</div>
	</div>`

/*
const ideaEditorTemplate = `
	<div style="display:flex; flex-direction:column; min-width:20em; min-height:10em">
		<div class="editor"></div>
		<div class="content" style="flex: 1; outline: 1px dashed grey"></div>
	</div>`
*/

export class HTMLMsaChatElement extends HTMLElement {

	connectedCallback() {
		this.messages = []
		this.Q = Q
		this.baseUrl = this.getAttribute("base-url")
		this.chatId = this.getAttribute("chat-id")
		this.innerHTML = this.getTemplate()
		this.initActions()
		//this.initIntro()
		this.getChat()
	}

	getTemplate() { return template }
	getMessageTemplate() { return msgTemplate }

	initActions() {
		this.Q(".config").onclick = () => this.popupConfig()
		//if (this.canEdit) {
		if (true) {
			const input = this.querySelector(".new_message")
			input.onkeydown = evt => {
				if (evt.keyCode === 13) { // ENTER
					this.postMessage({ content: input.value })
					input.value = ""
				}
			}
		}
	}

	getChat() {
		ajax("GET", `${this.baseUrl}/_list/${this.chatId}`,
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
	/*
		initIntro() {
			const sheet = document.createElement("msa-sheet")
			sheet.setAttribute("base-url", `${this.baseUrl}/_sheet/${this.ideasId}`)
			sheet.setAttribute("sheet-id", `intro`)
			sheet.setAttribute("fetch", "true")
			sheet.style.minHeight = "5em"
			sheet.style.border = "1px dashed grey"
			this.Q(".intro").appendChild(sheet)
		}
		*/
	/*
		initVotes(votes) {
			// store votes by id
			this.votes = votes.reduce((obj, vote) => {
				if (vote) obj[vote.id] = vote; return obj
			}, {})
		}
	*/

	addMessages(newMsgs) {
		const msgsEl = this.querySelector(".messages")
		const msgs = this.messages
		for (let msg of newMsgs) {
			const ite = uniqueOrderedInsert(msgs, msg, (a, b) => b.num - a.num)
			if (ite < 0) continue
			const el = this.createMessage(msg)
			msg.el = el
			if (ite === msgs.length - 1)
				msgsEl.appendChild(el)
			else
				msgsEl.insertBefore(el, msgs[ite + 1].el)
		}
	}

	// return true if idea1 is "greater" then idea2
	/*
	compareChat(idea1, idea2) {
		const vote1 = idea1.vote, vote2 = idea2.vote
		if (!vote1) return false
		if (vote1 && !vote2) return true
		const nb1 = vote1.nb, nb2 = vote2.nb
		if (!nb1) return false
		if (nb1 > 0 && !nb2) return true
		const score1 = vote1.sum / nb1, score2 = vote2.sum / nb2
		return score1 > score2
	}
	*/

	syncMessages() {
		const msgsEl = this.querySelector(".messages"),
			msgsEls = msgsEl.children,
			nbMsgs = msgsEls.length
		let curMsgIte = 0
		for (let msg of this.messages) {
			if (msg.el) continue
			while (curMsgIte < nbMsgs && (msgsEls[curMsgIte].message.num < msg.num))
				curMsgIte += 1
			const el = this.createMessage(msg)
			msg.el = el
			if (curMsgIte < nbMsgs) msgsEl.insertBefore(el, msgsEls[curMsgIte])
			else msgsEl.appendChild(el)
		}
	}

	createMessage(msg) {
		const msgEl = toEl(this.getMessageTemplate())
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
						ajax("DELETE", `${this.baseUrl}/_message/${this.chatId}/${msg.num}`)
							.then(() => msgEl.remove())
					})
			}
		}
		// sync
		this.syncMessage(msgEl)
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
	syncMessage(msgEl) {
		const msg = msgEl.message
		msgEl.querySelector(".content").innerHTML = msg.content || ""
		if (msg.createdBy) {
			msgEl.querySelector(".meta .createdBy").textContent = `${msg.createdBy}:`
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
		let path = `${this.baseUrl}/_message/${this.chatId}`
		if (msg.num !== undefined)
			path += `/${msg.num}`
		const body = { parent: msg.parent, content: msg.content }
		if (!User) {
			body["by"] = await addInputPopup(this, "You are not signed. Please provide a name")
		}
		await ajax("POST", path, { body })
		this.getChat()
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

function toEl(html) {
	const t = document.createElement("template")
	t.innerHTML = html
	return t.content.children[0]
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
