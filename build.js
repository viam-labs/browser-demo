#!/usr/bin/env node
const esbuild = require('esbuild')

esbuild.serve({
	servedir: 'static',
	port: process.env.PORT || 8000,
}, {
	entryPoints: ['src/main.ts'],
	bundle: true,
	sourcemap: true,
	sourcesContent: true,
	target: [
		'es2015',
	],
	outfile: 'static/main.js',
    define: {
        'process.env.ROBOT_LOCATION': JSON.stringify(process.env.ROBOT_LOCATION),
        'process.env.ROBOT_KEY': JSON.stringify(process.env.ROBOT_KEY),
		'process.env.ROBOT_KEY_ID': JSON.stringify(process.env.ROBOT_KEY_ID)
      }
})