const { PermNum } = Msa.require("user/perm")
const { isAdmin } = Msa.require("user/utils")

const labels = [
	{ name: "None" },
	{ name: "Read" },
	{ name: "Propose" },
	{ name: "Admin" }]

class ChatPerm extends PermNum {
	getMaxVal() { return 3 }
	getLabels() { return labels }
	getDefaultValue() { return 2 }
	overwriteSolve(user) {
		if (isAdmin(user)) return 3
	}
}
ChatPerm.NONE = 0
ChatPerm.READ = 1
ChatPerm.PROPOSE = 2
ChatPerm.ADMIN = 3

module.exports = { ChatPerm }