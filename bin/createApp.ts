#!/usr/bin/env node
/* eslint no-console: "off" */
import { exec as child_exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import util from 'util'

// Utility functions
const exec = util.promisify(child_exec)

const runCmd = async (command: string) => {
  try {
    const { stdout, stderr } = await exec(command)
    console.log(stdout)
    console.log(stderr)
  } catch(err) {
    console.log(err)
  }
}

// Validate arguments
if (process.argv.length < 3) {
  console.log('Please specify the target project directory.')
  console.log('For example:')
  console.log('    npx create-cf-planetscale-app my-app')
  console.log('    OR')
  console.log('    npm init create-cf-planetscale-app my-app')
  process.exit(1)
}

// Define constants
const ownPath = process.cwd()
const folderName = process.argv[2]
const appPath = path.join(ownPath, folderName)
const repo = 'https://github.com/OultimoCoder/cloudflare-planetscale-hono-boilerplate'

// Check if directory already exists
try {
  fs.mkdirSync(appPath)
} catch (err) {
  if (err.code === 'EEXIST') {
    console.log('Directory already exists. Please choose another name for the project.')
  } else {
    console.log(err)
  }
  process.exit(1)
}

const setup = async () => {
  try {
    // Clone repo
    console.log(`Downloading files from repo ${repo}`)
    await runCmd(`git clone --depth 1 ${repo} ${folderName}`)
    console.log('Cloned successfully.')
    console.log('')

    // Change directory
    process.chdir(appPath)

    // Install dependencies
    console.log('Installing dependencies...')
    await runCmd('npm install')
    console.log('Dependencies installed successfully.')
    console.log()

    // Copy wrangler.toml
    fs.copyFileSync(
      path.join(appPath, 'wrangler.toml.example'),
      path.join(appPath, 'wrangler.toml')
    )
    console.log('wrangler.toml copied.')

    // Delete .git folder
    await runCmd('npx rimraf ./.git')

    // Remove extra files
    fs.unlinkSync(path.join(appPath, 'TODO.md'))
    fs.unlinkSync(path.join(appPath, 'bin', 'createApp.ts'))
    fs.rmdirSync(path.join(appPath, 'bin'))

    console.log('Installation is now complete!')
    console.log()
    console.log('Enjoy your production-ready Cloudflare Workers project!')
    console.log('Check README.md for more info.')
  } catch (error) {
    console.log(error)
  }
}

setup()
