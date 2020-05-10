const { ParamDict, addGlobalParam } = Msa.require("params")
const { ChatPerm } = require("./perm")

class ChatParamDict extends ParamDict {
    constructor() {
        super()
        this.perm = ChatPerm.newParam()
    }
}

function addChatGlobalParams() {
    addGlobalParam("chat", ChatParamDict)
}

module.exports = { ChatParamDict, addChatGlobalParams }
