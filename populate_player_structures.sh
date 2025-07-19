#!/bin/bash
#set -e

# Set /tmp if this env variable is not set
: "${RUNNER_TEMP:=/tmp}"

export CSV_URL="https://static.adam4eve.eu/IDs/playerStructure_IDs.csv"
export CSV_FILE="$RUNNER_TEMP/structures.csv"
export JSON_FILE="www/structurs.json"

echo $CSV_FILE 
echo $JSON_FILE

# Download CSV
curl -sSL -o "$CSV_FILE" "$CSV_URL"

# Install parser if needed
npm install csv-parser

# Convert CSV to JSON (mapping structureID → name)
node << 'EOF'
const fs = require('fs');
const csv = require('csv-parser');
const results = {};
fs.createReadStream(process.env.CSV_FILE)
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (row.structureID && row.name) {
      results[row.structureID] = row.name.replace(/^"|"$/g, '');
    }
  })
  .on('end', () => {
    fs.writeFileSync(process.env.JSON_FILE, JSON.stringify(results, null, 2));
  });
EOF


