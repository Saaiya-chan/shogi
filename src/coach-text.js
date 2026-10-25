// Keep coordinate references concise, including provider text and older saved replies.
export function formatCoachText(value){return String(value??'').replace(/([1-9１-９一二三四五六七八九]{2})(?:の)?(?:升目?|マス目?)/g,'$1').replace(/動ける(?:升|マス)(?:の数)?/g,'動ける範囲').replace(/升目|升/g,'位置')}
