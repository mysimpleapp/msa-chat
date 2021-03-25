const { ChatParamDict } = require("./params")

const exp = module.exports = {}


exp.Chat = class {

    constructor(id) {
        this.id = id
        this.params = new ChatParamDict()
    }

    formatForDb() {
        const res = {
            _id: this.id
        }
        res.params = this.params.getAsDbStr()
        return res
    }

    parseFromDb(dbChat) {
        this.params = ChatParamDict.newFromDbStr(dbChat.params)
    }

    static newFromDb(id, dbChat) {
        const _this = new this(id)
        if (dbChat) _this.parseFromDb(dbChat)
        return _this
    }
}


const MSG_FIELDS = [ "parent", "content", "createdById", "createdBy", "updatedBy", "createdAt", "updatedAt" ]

exp.ChatMessage = class {

    constructor(chatId, num) {
        this.chatId = chatId
        this.num = num
    }

    formatForDb() {
        const res = {
            _id: `${this.chatId}-${this.num}`,
            chatId: this.chatId,
            num: this.num
        }
        MSG_FIELDS.forEach(f => res[f] = this[f])
        res.createdAt = res.createdAt ? res.createdAt.toISOString() : null
        res.updatedAt = res.updatedAt ? res.updatedAt.toISOString() : null
        return res
    }

    parseFromDb(dbMsg) {
        MSG_FIELDS.forEach(f => this[f] = dbMsg[f])
        this.createdAt = this.createdAt ? new Date(this.createdAt) : null
        this.updatedAt = this.updatedAt ? new Date(this.updatedAt) : null
    }

    static newFromDb(chatId, num, dbMsg) {
        const _this = new this(chatId, num)
        if (dbMsg) _this.parseFromDb(dbMsg)
        return _this
    }
}