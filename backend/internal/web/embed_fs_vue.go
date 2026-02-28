//go:build embed && !react

package web

import "embed"

//go:embed all:dist-vue
var frontendFS embed.FS

const embedSubDir = "dist-vue"
