const { ChatParamDict } = require("./params")

const exp = module.exports = {}


exp.Chat = class {

    constructor(id) {
        this.id = id
        this.params = new ChatParamDict()
    }

    formatForDb() {
        const res = {}
        if (!keys || keys.indexOf("id") >= 0)
            res.id = this.id
        if (!keys || keys.indexOf("params") >= 0)
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


exp.ChatMessage = class {

    constructor(id, num) {
        this.id = id
        this.num = num
    }

    formatForDb(keys) {
        const res = {}
        if (!keys || keys.indexOf("id") >= 0)
            res.id = this.id
        if (!keys || keys.indexOf("num") >= 0)
            res.num = this.num
        if (!keys || keys.indexOf("parent") >= 0)
            res.parent = this.parent
        if (!keys || keys.indexOf("content") >= 0)
            res.content = this.content
        if (!keys || keys.indexOf("createdById") >= 0)
            res.createdById = this.createdById
        if (!keys || keys.indexOf("createdBy") >= 0)
            res.createdBy = this.createdBy
        if (!keys || keys.indexOf("updatedBy") >= 0)
            res.updatedBy = this.updatedBy
        if (!keys || keys.indexOf("createdAt") >= 0)
            res.createdAt = this.createdAt ? this.createdAt.toISOString() : null
        if (!keys || keys.indexOf("updatedAt") >= 0)
            res.updatedAt = this.updatedAt ? this.updatedAt.toISOString() : null
        return res
    }

    parseFromDb(dbMsg) {
        this.parent = dbMsg.parent
        this.content = dbMsg.content
        this.createdById = dbMsg.createdById
        this.createdBy = dbMsg.createdBy
        this.updatedBy = dbMsg.updatedBy
        this.createdAt = dbMsg.createdAt ? new Date(dbMsg.createdAt) : null
        this.updatedAt = dbMsg.updatedAt ? new Date(dbMsg.updatedAt) : null
    }

    static newFromDb(id, num, dbMsg) {
        const _this = new this(id, num)
        if (dbMsg) _this.parseFromDb(dbMsg)
        return _this
    }
}