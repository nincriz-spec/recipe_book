const express = require('express');
require('dotenv').config();
const cors = require('cors'); 
const { connect } = require('./db')
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')

function generateAccessToken(id) {
    return jwt.sign({
        user_id: id,
        role: "admin"
        }, process.env.TOKEN_SECRET, {
            expiresIn: '1h'
    })
}

function generateRefrshToken(id) {
    return jwt.sign({
        user_id: id,
        }, process.env.TOKEN_SECRET, {
            expiresIn: '5h'
    })

}



const app = express();


app.use(express.json()); 
app.use(cors()); 

async function main(){
    const db = await connect(process.env.MONGO_URI, "recipe_book");
    console.log('Connected to MongoDB');

    app.get('/api/recipes', async function (req, res){
        const{preptime_lesser, preptime_greater, cooktime_lesser, cooktime_greater, dish_type} = req.query;
        let filter = {};

        if(preptime_lesser && !preptime_greater){ //preptime lesser provided AND greater is not provided so it show the preptime less value
            filter.prepTime ={                   
                $lt: Number(preptime_lesser) 
            };
        }
        if(preptime_greater && !preptime_lesser){ //preptime greater provided AND lesser is not provided so it show the preptime greater value
            filter.prepTime ={
                $gt: Number(preptime_greater)
            };
        }

        if (preptime_lesser && preptime_greater) { // both lesser and greater are provided so it will show in between values
            filter.prepTime = {
                $gt: Number(preptime_greater),
                $lt: Number(preptime_lesser)
            }
        }
         if(cooktime_lesser && !cooktime_greater){
            filter.cookTime ={
                $lt: Number(cooktime_lesser)
            };
        }
        if(cooktime_greater && !cooktime_lesser){
            filter.cookTime ={
                $gt: Number(cooktime_greater)
            };
        }

        if (cooktime_lesser && cooktime_greater) {
            filter.cookTime = {
                $gt: Number(cooktime_greater),
                $lt: Number(cooktime_lesser)
            }
        }

        if(dish_type){
            filter.dish_type = { $regex: dish_type, $options: 'i' }
        }

        const recipes = await db.collection("recipes").find(filter).toArray();
        res.json({
            "recipe": recipes
        })
    })
    
    app.post('/api/recipes', async function (req, res){
        try {
            const { name, prepTime, cookTime, dish_type} = req.body;

        if (!name || !prepTime || !cookTime || !dish_type) {
            return res.status(400).json({
                'error': 'Missing required fields'
            });
        }
            const types =['mains', 'dessert', 'sides', 'appetizers'];
            if(!types.includes(dish_type)){
                return res.status(400).json({
                    'error': "dish type not found"
                })
            }

            const result = await db.collection("recipes").insertOne({
                name,
                prepTime,
                cookTime,
                dish_type
            });
        
            res.json({
                'message': 'dish type added succesfully',
                'recipeId': result.insertedId
            })
    
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                'error':"Unable to add dish type"
            })
        }

    })

    app.put('/api/recipes/:id', async function (req, res){
        try {
            const { name, prepTime, cookTime, dish_type} = req.body;
            if (!name || !prepTime || !cookTime || !dish_type) {
            return res.status(400).json({
                'error': 'Missing required fields'
            });
        }
            const types =['mains', 'dessert', 'sides', 'appetizers'];
            if(!types.includes(dish_type)){
                return res.status(400).json({
                    'error': "dish type not found"
                })
            }

             const updatedRecipe = {
                name,
                prepTime,
                cookTime,
                dish_type
            }

            console.log(updatedRecipe);

            const results = await db.collection('recipes').updateOne({
                _id: new ObjectId(req.params.id)
            },
                { $set: updatedRecipe }
            )

            if (results.matchedCount === 0) {
                return res.status(400).json({
                    'error': 'Not found'
                })
            }

            res.json({
                'message': 'Recipe has been updated'
            })
    
        } catch (e) {
            console.error(e);
            return res.status(500).json({
                'error':"Unable to update"
            })
        }

    })

    app.post('/api/courses', async function (req, res) {
    try {
        const { name, description, recipes } = req.body;

        if (!name || !description) {
            return res.status(400).json({
                'error': 'Missing required fields'
            });
        }

        const newCourse = {
            name,
            description,
            recipes: recipes 
        };

        const result = await db.collection('courses').insertOne(newCourse);

        res.json({
            'message': 'Course added successfully',
            'courseId': result.insertedId
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({
            'error': 'Unable to add course'
        });
    }
});
    app.put('/api/courses/:id', async function (req, res) {
    try {
        const { recipe } = req.body; 

        if (!recipe) {
            return res.status(400).json({
                'error': 'Missing required fields'
            });
        }


        const result = await db.collection('courses').updateOne(
            { _id: new ObjectId(req.params.id) },
            {
                $push: { //add another value
                    recipes: recipe
                }
            }
        );

        res.json({
            'message': 'Recipe added to course'
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({
            'error': 'Unable to add recipe to course'
        });
    }
});
    app.delete('/api/courses/:id', async function (req, res) {
    try {
        const { recipe } = req.body;

        if (!recipe) {
            return res.status(400).json({
                'error': 'Missing required fields'
            });
        }

        await db.collection('courses').deleteOne(
            { _id: new ObjectId(req.params.id) },
            {
                $pull: { //pull something out of the array
                    recipes: { $regex: recipe, $options: 'i' }
                }
            }
        );

        res.json({
            'message': 'Recipe removed from course'
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({
            'error': 'Unable to remove recipe from course'
        });
    }

    app.post('/users', async function(req, res){
        

    })




});
   app.post('/users', async function (req, res) {
    const password = await bcrypt.hash(req.body.password, 12);
    const email = req.body.email;

    const existingUser = await db.collection('users').findOne({ 
        email: email
        });
        if (existingUser) {
            return res.status(400).json({
                'error': 'Email is already in use'
                 });
                }


    const result = await db.collection('users').insertOne({
        email, password
          });
        res.status(201).json({
            'message': 'New user has been created',
            result
        })
    });

    app.post('/login', async function (req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            })
        }

        const user = await db.collection("users").findOne({
            email
        });
        if (user) {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    error: "Access Denied"
                })
            }
            const accessToken = generateAccessToken(user._id);
            const refreshToken = generateRefreshToken(user._id);
            res.json({
                accessToken,
                refreshToken
            })

        } else {
            return res.status(401).json({
                error: "Access Denied"
            })
        }

    })

    app.post('/refresh', async function (req, res) { 
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                error: "Refresh token is required"
                });
        }

        try {

            const payload = jwt.verify(
                refreshToken,
                process.env.TOKEN_SECRET
                );
                
            const accessToken = generateAccessToken(payload.user_id);
            res.json({
            })
            
         } catch (e) {
            return res.status(403).json({
                error: "Invalid or expired refresh token"
            });
        }
    })
    
}
main();



app.listen(3000, function () {
    console.log("Server has started");
})