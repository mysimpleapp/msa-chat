const { ParamDict, addGlobalParam } = Msa.require("params")
const { ChatPerm } = require("./perm")

class ChatParamDict extends ParamDict {
    constructor() {
        super()
        this.perm = ChatPerm.newParam()
    }
}

addGlobalParam("chat", ChatParamDict)

module.exports = { ChatParamDict }
