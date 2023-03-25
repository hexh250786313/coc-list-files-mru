vim.cmd([[
function! DebugCoc()
    :CocList filesMru
endfunction

set runtimepath^=~/workspace/hexh/coc-list-files-mru
let g:coc_node_args = ["--nolazy", "--inspect=6989"]
]])
