const express = require('express')
const mongoskin = require('mongoskin')
const bodyParser = require('body-parser')
const logger = require('morgan')
const http = require('http')
const Queue = require('bull')

const superagent = require('superagent');
const jp = require('jsonpath');

const Sheets = require('./sheets')

const app = express()

const db_url = process.env.MONGODB_URI || 'mongodb://@localhost:27017/test'

app.set('port', process.env.PORT || 3000)

app.use(bodyParser.json())
app.use(logger())

const db = mongoskin.db(db_url)
const id = mongoskin.helper.toObjectID

const jobQueue = new Queue('bull-jobs');

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
    datetime: Date.now(),
  },    {delay: 3000}
  )
  res.send(job)
})

app.get('/job/:jobId', async (req, res, next) => {
  const job = await jobQueue.getJob(req.params.jobId)
  res.send(job)
})

app.get('/jobs', async (req, res, next) => {
  const jobs = await jobQueue.getJobs()
  res.send(jobs)
})

app.get('/jobcount', async (req, res, next) => {
  const jobCounts = await jobQueue.getJobCounts()
  res.send(jobCounts)
})

app.get('/something', async (req, resp, next) => {

  const res = await superagent.get('https://api.nasa.gov/planetary/apod').query({ api_key: 'DEMO_KEY', date: '2017-08-02' })

  console.log(res.headers);
  console.log(res.body.url);
  console.log(res.body.explanation);

  console.log(jp.query(res.body, '$..url'));

  const pic_path = "$.." + "url"
  const name_path = "$.." + "title"

  // resp.send({"pic": jp.query(res.body, pic_path).shift(), "name": jp.query(res.body, name_path).shift() })
  resp.send(Object.assign({}, {"status": res.status}, {"headers": res.headers},{"body": res.body}))

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

  jobQueue.process(function (job, done) {
    console.log("Got a job: " + job.id)
    console.log(job.data)

    setTimeout(function() {
      console.log(`DONE ${job.id}`)
      done()
    }, 2000)

  });

  jobQueue.on('completed', job => {
    console.log(`Job with id ${job.id} has been completed`);
  })

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
