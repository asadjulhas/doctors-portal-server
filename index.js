const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config();

// For Payment
const stripe = require("stripe")(process.env.STRIPE_SECRATE_KEY);
// Email
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');



// Middleware
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vbgxx.mongodb.net/?retryWrites=true&w=majority`;
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

const emailSenderOptions = {
  auth: {
    api_key: process.env.SENDGRID_API_KEY
  }
}
const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));



function sendAppointmentEmail (booking) {
  const {email, serviceName, userName, date, slot} = booking;

  const sendEmail = {
    from: process.env.EMAIL_SENDER,
    to: email,
    subject: `Your Appointment for ${serviceName} is on ${date} at ${slot} is Confirmed!`,
    text: `Your Appointment for ${serviceName} is on ${date} at ${slot} is Confirmed!`,
    html: `
    <div>
    <p>Hello ${userName}</p>
    <p>Your Appointment for ${serviceName} is Confirmed!</p>
    <p>Looking forward to deeing you on ${date} at ${slot} </p>
    <a href="www.asadjulhas.com?un=${email}">UnSubscribe</a>
    </div>
    `
  };

  emailClient.sendMail(sendEmail, function(err, info){
    if (err ){
      console.log(err);
    }
    else {
      // console.log('Message sent: ', info);
    }
});

}

async function run() {
  try {
    await client.connect();
    
    const userCollections = client.db('asad-julhas').collection('users')
    const introCollections = client.db('asad-julhas').collection('intro')

    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const tokenEmail = req.decoded.email;
        const tokenQuery = {email: tokenEmail, role: 'admin'}
        const checkAdmin = await userCollections.findOne(tokenQuery);
        if(checkAdmin) { 
          next();
        } else {
          res.send({message: 'You dont have admin access bro'})
        }
    }


// Payment function


// app.post("/create-payment-intent", verifyUser, async (req, res) => {
//   const service  = req.body;
//   const price = service.amount;
//   const amount = price * 100;
//  console.log(amount)
 
//   const paymentIntent = await stripe.paymentIntents.create({
//     amount: amount,
//     currency: "usd",
//     automatic_payment_methods: {
//       enabled: true,
//     },
//   });

//   res.send({
//     clientSecret: paymentIntent.client_secret,
//   });


// })


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
    //    app.put('/admin/:email', verifyUser, verifyAdmin, async (req, res) => {
    //     const email = req.params.email;
    //       const query = {email: email};
    //     const updateDoc = {
    //       $set: {role: 'admin'}
    //     };
    //     const result = await userCollections.updateOne(query, updateDoc);
    //     res.send({result})
        
  
    //   })

    // // Remove Admin 
    //    app.put('/remove-admin/:email', verifyUser, verifyAdmin, async (req, res) => {
    //     const email = req.params.email;
    //     const query = {email: email};
    //     const updateDoc = {
    //       $set: {role: ''}
    //     };
    //     const result = await userCollections.updateOne(query, updateDoc);
    //     res.send({result})
    //   })

      app.get('/check-admin/:email', verifyUser, async (req, res) => {
        const email = req.params.email;
        const Query = {email: email, role: 'admin'}
        const checkAdmin = await userCollections.findOne(Query);
        res.send(checkAdmin)
      })


    // Get Banner short intro
    app.get('/intro', verifyUser, verifyAdmin, async (req, res) => {
      const query = {};
      const allUsers = await introCollections.find(query).toArray();
      res.send(allUsers);
    })

    // Add doctor
    app.post('/doctor', verifyUser, verifyAdmin, async (req, res) => {
      const doctor = req.body;
       const result = await doctorCollections.insertOne(doctor);
       res.send(result)
    })

    
    // Delete doctor
    app.delete('/delete/:id', verifyUser, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const result = await doctorCollections.deleteOne(query);
      res.send(result)
    })
    

// Update payment status for booking
app.put('/payment/:id', verifyUser, async (req, res) => {
  const id = req.params.id;
  const paymentIntent = req.body;
  const query = {_id: ObjectId(id)};
  const updateDoc = {
    $set: {payment: true, transactionId: paymentIntent.paymentIntent.id}
  };
  const result = await bookingCollections.updateOne(query, updateDoc);
  const setPayment = await paymentCollections.insertOne(paymentIntent.paymentIntent);
  res.send({result})

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
  console.log('Opening Asad-Julhas server on port', port)
})