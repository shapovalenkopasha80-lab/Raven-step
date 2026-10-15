#!/usr/bin/env python3
"""Build a Foundry release using the real GitHub repository name."""
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED


def build(repository, tag):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Repository must be OWNER/REPOSITORY')
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'module.json').read_text(encoding='utf-8'))
    if tag != f"v{manifest['version']}":
        raise ValueError(f"Tag must be v{manifest['version']} (or update module.json first)")
    base = f'https://github.com/{repository}'
    manifest.update(url=base, manifest=f'{base}/releases/latest/download/module.json',
                    download=f'{base}/releases/download/{tag}/raven-step.zip')
    out = root / 'dist'
    out.mkdir(exist_ok=True)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    (out / 'module.json').write_text(encoded, encoding='utf-8')
    files = ['README_UA.md', 'macro.js', 'macro-misty-step.js']
    for folder in ('scripts', 'assets'):
        files.extend(str(p.relative_to(root)) for p in sorted((root / folder).rglob('*')) if p.is_file())
    with ZipFile(out / 'raven-step.zip', 'w', ZIP_DEFLATED) as archive:
        archive.writestr('module.json', encoded)
        for name in files:
            archive.write(root / name, name)
    with ZipFile(out / 'raven-step.zip') as archive:
        assert archive.testzip() is None
        assert archive.read('module.json') == (out / 'module.json').read_bytes()
        for name in manifest['esmodules']:
            assert name in archive.namelist()
        assert 'assets/shadow-step.wav' in archive.namelist()
    print(f"Manifest URL: {manifest['manifest']}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    build(args.repository, args.tag)
