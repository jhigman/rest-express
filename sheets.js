const GoogleSpreadsheet = require('google-spreadsheet')

class Sheets {

  constructor(id) {
    this.creds = require('./google-generated-creds.json')
    this.doc = new GoogleSpreadsheet(id);
  }

  async info() {
    await this.doc.useServiceAccountAuth(this.creds, () => {
      console.log(`auth done..`)
      console.log(this.creds)
      this.doc.getInfo((err, details) => {
        console.log('processing info..')
        console.log(details)
        this.send(details.worksheets[0], Date.now())
      })
    });
    console.log('done')
  }

  async send(sheet, timestamp) {
    sheet.getCells({
      'min-row': 1,
      'max-row': 5,
      'return-empty': true
    }, function(err, cells) {
      var cell = cells[0]
      console.log('Cell R'+cell.row+'C'+cell.col+' = '+cell.value)
      cell.value = timestamp
      cell.save()
    })
  }
}

module.exports = Sheets

