#!/bin/bash

# Load nvm and use Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || echo "Warning: nvm not available or Node 20 not installed"

unset GITHUB_TOKEN

INSTALL=0
PRE_RELEASE=0
RELEASE=1
DEVELOPMENT=0
SKIP_COMPILE=0

while getopts ":iprds" OPT; do
  case ${OPT} in
    i)
      INSTALL=1
      ;;
    p)
      PRE_RELEASE=1
      ;;
    r)
      RELEASE=1
      ;;
    d)
      DEVELOPMENT=1
      ;;
    s)
      SKIP_COMPILE=1
      ;;
    *)
      usage
      ;;
  esac
done

# copy all files to dist
declare FILES=(
  .vscodeignore
  .babelrc
  CHANGELOG
  LICENSE
  LICENSE.txt
  README.md
  webpack.config.js
  package.json
  icon.png
  AzurePipelineParser.g4
  AzurePipelineLexer.g4
  azurePipelineYaml.js
  extension.js
  parser.js
  formatter.js
  utils.js
  tests)

mkdir -p dist
cp -af "${FILES[@]}" dist
cd dist || exit 1

if [ ${INSTALL} -eq 1 ]; then
  npm install -g @vscode/vsce
  npm install -g webpack-cli
  npm install -g webpack
  npm install -g prettier
fi

npm install

if [ ${SKIP_COMPILE} -eq 0 ]; then
  npm run compile
else
  echo "Skipping ANTLR compile step (-s flag)"
fi

# Build with webpack (npm scripts already call webpack, don't call it twice)
# Webpack outputs to extension-bundle.js to avoid overwriting source
if [ ${DEVELOPMENT} -eq 1 ]; then
  npm run build:dev
else
  npm run build:prod
fi

# Rename the bundled file to extension.js for the VSIX package
if [ -f "extension-bundle.js" ]; then
  # Also copy the bundle to root for pre-commit hook usage
  cp extension-bundle.js ../extension-bundle.js
  mv extension-bundle.js extension.js
  # Update package.json to point to extension.js
  sed -i 's|"main": "./extension-bundle.js"|"main": "./extension.js"|' package.json
fi

rm -f ./*.vsix

#VERSION=$(jq -Mr .version package.json)
if [ ${RELEASE} -eq 1 ]; then
  if [ ${PRE_RELEASE} -eq 1 ]; then
    vsce package --pre-release
  else
    vsce package
  fi
  #scp "ado-pipeline-navigator-${VERSION}.vsix" tools:/var/www/html/files/ado-pipeline-navigator.vsix
  #code --install-extension "ado-pipeline-navigator-${VERSION}.vsix"
  #vsce publish --pre-release
fi

rm -f ../*.vsix
mv ./*.vsix ../
