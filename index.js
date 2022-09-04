const express = require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const objectId = require('mongodb').ObjectId;
const jwt = require('jsonwebtoken');
const { ObjectID } = require('bson');
const stripe = require('stripe')(process.env.STRIP_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello world!! server is running')
})

// ======= middleware jwt ========
function verifyJWT(req, res, next){
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if(err){
      return res.status(403).send({message: 'Forbidden access'})
    } 
    req.decoded = decoded;
    next();
  });
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lqrsw.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
  try{
    await client.connect();
    const userCollection = client.db("nabojagoron").collection("users");
    const applyUserCollection = client.db("nabojagoron").collection("applyUsers");
    const productCollection = client.db("manufacturer").collection("products");
    const attendanceCollection = client.db("nabojagoron").collection("attendances");
    const ExamResultsCollection = client.db("nabojagoron").collection("ExamResults");
    const ExamNameCollection = client.db("nabojagoron").collection("ExamName");
    const reviewCollection = client.db("nabojagoron").collection("reviews");
    const paymentCollection = client.db("manufacturer").collection("payment");

    //  ======= middleware verify Admin ========
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({email: requester});
      // console.log(requesterAccount);
      if(requesterAccount.role === "admin"){
        next();
      }else{
        return res.status(403).send({message: 'Forbidden access'})
      }
    }

    // =====get method====
    app.get('/user', async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    app.get('/applyUser', async (req, res) => {
      const users = await applyUserCollection.find().toArray();
      res.send(users.reverse());
    })

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === "admin"
      res.send({admin: isAdmin});
    })

    app.get('/UserProfile/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      res.send(user);
    })

    app.get('/attendance/:classes', async (req, res) => {
      const classes = req.params.classes;
      const query = { class: classes }
      const result = await attendanceCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/ExamResult/:name', async (req, res) => {
      const name = req.params.name;
      const query = { name: name }
      const result = await ExamResultsCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/ExamResults/:email', async (req, res) => {
      const email = req.params.email;
      const query = { student: email }
      const result = await ExamResultsCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/order', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.get('/myOrder', async (req, res) => {
      const email = req.query.email
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/ExamName', async (req, res) => {
      const result = await ExamNameCollection.find().toArray();
      res.send(result);
    });

    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result.reverse());
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      const product = await productCollection.findOne(query);
      res.send(product);
    })

    app.get('/payProduct/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      const product = await orderCollection.findOne(query);
      res.send(product);
    })

    // ===== Post method =======
    app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    })

    app.post('/review', verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    })


    app.post('/attendance', async (req, res) => {
      const attendance = req.body;
      const result = await attendanceCollection.insertOne(attendance);
      res.send(result);
    })

    app.post('/ExamResult', async (req, res) => {
      const examResult = req.body;
      const result = await ExamResultsCollection.insertOne(examResult);
      res.send(result);
    })

    app.post('/applyUser/:email', async (req, res) => {
      const email = req.params.email;
      const applyUser = req.body;
      const result = await applyUserCollection.insertOne(applyUser);
      res.send(result);
    })

    // payment getway method api
    app.post('/create-payment-intent', async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // ===== patch method ======

    app.patch('/order/:id', async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectID(id)};
      const updateDoc = {
        $set: {
          paid: true,
          status: 'pending',
          transactionId: payment.transactionId,
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updateOrder = await orderCollection.updateOne(filter, updateDoc);
      res.send(updateDoc, result, updateOrder); 
    })

    // ===== Delete method ======
    app.delete('/product/:id',  async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      console.log(query)
      const result = await productCollection.deleteOne(query);
      res.send(result);
    })

    app.delete('/myOrder/:id',  async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      console.log(query)
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    })

    app.delete('/applyUser/:id',  async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      const result = await applyUserCollection.deleteOne(query);
      res.send(result);
    })

    app.delete('/user/:id',  async (req, res) => {
      const id = req.params.id;
      const query = {_id: objectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // ====== put method ======
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
        const filter = {email: email};
        const updateDoc = {
          $set: {role: "admin"}
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result)
    })

    app.put('/ExamResult/:id', async (req, res) => {
        const id = req.params.id;
        const data = req.body;

        const filter = {_id: ObjectID(id)}
        const options = { upsert: true };
        const updateDoc = {
          $push: {
            result: data
          }
        };
        const result = await ExamResultsCollection.updateOne(filter, updateDoc, options);
        res.send(result)
    })

    app.put('/ExamName/:id', async (req, res) => {
        const id = req.params.id;
        const data = req.body;
        const filter = {_id: ObjectID(id)}
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            name: data.name,
            date: data.date,
          }
        };
        const result = await ExamNameCollection.updateOne(filter, updateDoc, options);
        res.send(result)
    })

    app.put('/UpdateUser/:id', async (req, res) => {
        const id = req.params.id;
        const data = req.body;
        const filter = {_id: ObjectID(id)}
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            name: data.name,
            address: data.address,
            image: data.image,
            bio: data.bio
          }
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        res.send(result)
    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({result, token})
    })


  }finally{

  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Server is running at port ${port}`)
})