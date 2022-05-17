const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require('mongodb');



// Middleware
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-services.1laqf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyUser(req, res, next) {
  const authorization = req.headers.authorization;
  if(!authorization) {
    return res.status(401).send({Message: 'unauthorized access'})
  }
 const token = authorization.split(' ')[1]
 jwt.verify(token, process.env.JWT, (err, decoded) => {
   if(err) {
    return res.status(403).send({Message: 'Forbidden access'})
   }
   req.decoded = decoded
   next()
 })
}

async function run() {
  try {
    await client.connect();

    const servicesCollections = client.db('doctorsPortal').collection('services')
    const bookingCollections = client.db('doctorsPortal').collection('booking')
    const userCollections = client.db('doctorsPortal').collection('users')
    
    // Get all services
    app.get('/service', async (req, res) => {
      const query = {};
      const cursor = servicesCollections.find(query)
      const services = await cursor.toArray();
      res.send(services)
    })

    // Store booking
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {serviceName: booking.serviceName, date: booking.date, email: booking.email}
      const isExits = await bookingCollections.findOne(query);
      if(isExits) {
        return res.send(isExits)
      }
      const result = await bookingCollections.insertOne(booking);
      res.send(result)
    })

    // Available services
    app.get('/available', async (req, res) => {
      const date = req.query.date;
      const query = {date: date}
      const services = await servicesCollections.find().toArray()
      const booking = await bookingCollections.find(query).toArray();
      services.forEach(service => {
        const serviceBooking = booking.filter(s => s.serviceName === service.name);
        const booked = serviceBooking.map(b => b.slot);
        const available = service.slots.filter(s => !booked.includes(s));
        service.available = available;
        console.log(available)
      })
      res.send(services)
    }) 

    // My Appointments
    app.get('/my-appointment', verifyUser, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.decoded.email;
      if(tokenEmail === email) {
      const query = {email: email}
      const appointment = await bookingCollections.find(query).toArray();
      res.send(appointment)
    } else {
      return res.status(403).send({Message: 'Forbidden'})
    }
    }) 

    // Add/update user
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = {email: email};
      const options = { upsert: true };
      const updateDoc = {
        $set: user
      };
      const result = userCollections.updateOne(query, updateDoc, options);
     const accessToken = jwt.sign({ email }, process.env.JWT, {
       expiresIn: '1d'
     });
      res.send({accessToken})

    })

    // Make Admin 
       app.put('/admin/:email', async (req, res) => {
        const email = req.params.email;
        const authorization = req.headers.authorization;
        console.log(authorization)
        const query = {email: email};
        const updateDoc = {
          $set: {role: 'admin'}
        };
        const result = userCollections.updateOne(query, updateDoc);
        res.send({result})
  
      })

    // Remove Admin 
       app.put('/remove-admin/:email', async (req, res) => {
        const email = req.params.email;
        const query = {email: email};
        const updateDoc = {
          $set: {role: 'user'}
        };
        const result = userCollections.updateOne(query, updateDoc);
        res.send({result})
  
      })

    // Get all user
    app.get('/all-users', verifyUser, async (req, res) => {
      const query = {};
      const allUsers = await userCollections.find(query).toArray();
      res.send(allUsers);
    })

  }
  finally {
    // await client.close()
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello Clients')
})

app.listen(port, () => {
  console.log('Opening Doctor server on port', port)
})