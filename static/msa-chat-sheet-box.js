export function createSheetBox(sheet) {
    const baseUrl = sheet.getAttribute("base-url")
    const sheetId = sheet.getAttribute("sheet-id")
    let id
    for (id = 1; ; ++id)
        if (!sheet.querySelector(`msa-chat[chat-id='${id}']`))
            break
    return {
        wel: "/chat/msa-chat.js",
        attrs: {
            "base-url": `${baseUrl}/${sheetId}/box/chat`,
            "chat-id": id
        }
    }
}

export function exportSheetBox(el) {
    const attrs = {}
    for (let a of el.attributes) if (a.nodeValue) attrs[a.nodeName] = a.nodeValue
    return {
        wel: "/chat/msa-chat.js",
        attrs
    }
}