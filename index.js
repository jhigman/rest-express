const express = require('express')
const mongoskin = require('mongoskin')
const bodyParser = require('body-parser')
const logger = require('morgan')
const http = require('http')
const Bull = require('bull')

const Sheets = require('./sheets')

const app = express()

const db_url = process.env.MONGODB_URI || 'mongodb://@localhost:27017/test'

app.set('port', process.env.PORT || 3000)

app.use(bodyParser.json())
app.use(logger())

const db = mongoskin.db(db_url)
const id = mongoskin.helper.toObjectID

const jobQueue = new Bull('bull-jobs');

app.param('collectionName', (req, res, next, collectionName) => {
  req.collection = db.collection(collectionName)
  return next()
})

app.get('/', (req, res, next) => {
  res.send('Select a collection, e.g., /collections/messages')
})

app.get('/job/new', async (req, res, next) => {
  const job = await jobQueue.add({
    foo: 'bar',
    datetime: Date.now()
  })
  res.send(job)
})

app.get('/sheet/:sheetId', (req, res, next) => {
  const sheet = new Sheets(req.params.sheetId)
  sheet.info()
  res.send(`Called sheets for ${req.params.sheetId}`)
})

app.get('/collections/:collectionName', (req, res, next) => {
  req.collection.find({}, {limit: 10, sort: [['_id', -1]]})
    .toArray((e, results) => {
        if (e) return next(e)
        res.send(results)
      }
    )
})

app.post('/collections/:collectionName', (req, res, next) => {
  // TODO: Validate req.body
  req.collection.insert(req.body, {}, (e, results) => {
    if (e) return next(e)
    res.send(results.ops)
  })
})

app.get('/collections/:collectionName/:id', (req, res, next) => {
  req.collection.findOne({_id: id(req.params.id)}, (e, result) => {
    if (e) return next(e)
    res.send(result)
  })
})

app.put('/collections/:collectionName/:id', (req, res, next) => {
  req.collection.update({_id: id(req.params.id)},
    {$set: req.body},
    {safe: true, multi: false}, (e, result) => {
      if (e) return next(e)
      res.send((result.result.n === 1) ? {msg: 'success'} : {msg: 'error'})
    })
})

app.delete('/collections/:collectionName/:id', (req, res, next) => {
  req.collection.remove({_id: id(req.params.id)}, (e, result) => {
    if (e) return next(e)
    // console.log(result)
    res.send((result.result.n === 1) ? {msg: 'success'} : {msg: 'error'})
  })
})

const server = http.createServer(app)

const boot = () => {
  server.listen(app.get('port'), () => {
    console.info(`Express server listening on port ${app.get('port')}`)
  })

  jobQueue.process(async (job) => {
    console.log("Got a job: " + job.id)
    console.log(job.data)
  });

}

const shutdown = () => {
  server.close(process.exit)
}

if (require.main === module) {
  boot()
} else {
  console.info('Running app as a module')
  exports.boot = boot
  exports.shutdown = shutdown
  exports.port = app.get('port')
}
