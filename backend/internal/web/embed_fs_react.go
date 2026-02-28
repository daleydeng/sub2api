//go:build embed && react

package web

import "embed"

//go:embed all:dist-react
var frontendFS embed.FS

const embedSubDir = "dist-react"
