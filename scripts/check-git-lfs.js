#!/usr/bin/env node
/**
 * After clone/install, ensure DS model joblib files are materialized via Git LFS.
 * Skips quietly in CI or when ds/model is absent.
 */
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MODEL_DIR = path.join(ROOT, 'ds', 'model')
const MODEL_FILES = [
  'model.joblib',
  'text_to_job_title_classifier.joblib',
  'title_normalizer.joblib',
]

const MIN_BYTES = 1024

function isPointer(filePath) {
  if (!fs.existsSync(filePath)) return true
  if (fs.statSync(filePath).size >= MIN_BYTES) return false
  const head = fs.readFileSync(filePath, 'utf8', { start: 0, end: 80 })
  return head.startsWith('version https://git-lfs.github.com/spec/v1')
}

function hasGitLfs() {
  return spawnSync('git', ['lfs', 'version'], { stdio: 'ignore' }).status === 0
}

function main() {
  if (!fs.existsSync(MODEL_DIR)) return

  const pointers = MODEL_FILES.map((name) => path.join(MODEL_DIR, name)).filter(isPointer)
  if (pointers.length === 0) return

  if (!hasGitLfs()) {
    console.warn(
      '[CareerLens] DS model files are Git LFS pointers. Install Git LFS, then run:',
    )
    console.warn('  git lfs install && git lfs pull --include="ds/model/*.joblib"')
    return
  }

  try {
    execSync('git lfs install', { cwd: ROOT, stdio: 'ignore' })
    execSync('git lfs pull --include="ds/model/*.joblib"', {
      cwd: ROOT,
      stdio: 'inherit',
    })
  } catch {
    console.warn(
      '[CareerLens] git lfs pull failed. Run manually from repo root:',
    )
    console.warn('  git lfs pull --include="ds/model/*.joblib"')
  }
}

main()
