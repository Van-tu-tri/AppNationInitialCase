const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');


/*
HELPER FUNCTIONS:
1- isCityExist                      : city              => bool
2- isResponseExist                  : response, res     => bool
3- isUsernameExist                  : username          => bool
4- isTargetExist                    : user              => bool
5- isAdmin                          : role              => bool
6- isIDMatch                        : id1, id2          => bool
7- fetchCoordinatesFromCity         : city              => city coordinates
8- fetchWeatherFromCoordinate       : lat, lon          => weather conditions of the city
9- simplifyForecastList             : forecastList      => simplifies weather conditions of the city
10- saveWeatherQueryDB              : {city, userIf, simplifiedForecast}    => Saves query to database
11- cacheHitWeatherQueryDB          : city, userId      => returns weather query if hit
12- findUserByUsernameDB            : username
13- getWeatherQueriesByUserDB       : userId
*/


function isCityExist(city) {
    if (!city)  return false;
    else        return true;
};

function isResponseExist(response, res) {
    if (!response.data || response.data.length === 0) return false;
    else return true;
};

function isUsernameExist(username) {
    if (!username)  return false;
    else        return true;
};

function isTargetExist(user) {
    if (!user)  return false;
    else        return true;
};

function isAdmin(role){
    return role == "admin";
    
};

function isIDMatch(id1, id2){
    return id1 == id2;
};


async function fetchCoordinatesFromCity(city) {
    const response = await axios.get(process.env.WEATHER_FETCH_CITY_COORD_URL, {
      params: {
        q: city,
        limit: 1,
        appid: process.env.WEATHER_KEY,
      },
    });
    return response;
};

async function fetchWeatherFromCoordinate(lat, lon) {
    const weatherResponse = await axios.get(process.env.WEATHER_FETCH_WEATHER_FROM_COORD_URL, {
                params: {
                lat,
                lon,
                appid: process.env.WEATHER_KEY,
                units: "metric", // optional: for °C
                },
            });
    return weatherResponse;
};

function simplifyForecastList(forecastList) {
  return forecastList.map(entry => ({
    time: entry.dt_txt,
    temp: entry.main.temp,
    weather: entry.weather[0].description,
  }));
};

async function saveWeatherQueryDB({ city, userId, simplifiedForecast }) {
  const count = simplifiedForecast.length;

  return await prisma.weatherQuery.create({
    data: {
      city,
      forecast: {
        count,
        forecast: simplifiedForecast,
      },
      user: { connect: { id: userId } },
    },
  });
};

async function cacheHitWeatherQueryDB(city, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize to start of the day
    const existingQuery = await prisma.weatherQuery.findFirst({
        where: {
        city,
        userId,
        createdAt: {
            gte: today,
        },
        },
    });

    return existingQuery;
};

async function findUserByUsernameDB(username) {
const user = await prisma.user.findUnique({
      where: { username },
    });

    return user;
};

async function findWeatherQueriesByUserDB(userId) {
    const queries = await prisma.weatherQuery.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        });

    return queries;
}


/* 
API: 
1- getLocationFromCity      : res.status(200).json({ lat: latitude, lon: longitude});
2- getWeatherReportFromCity : return res.status(200).json({ city, forecast: simplifiedForecast });
3- getQueryHistory          : return res.status(200).json({ username, count: queries.length, history: queries });
*/

const getLocationFromCity = async (req, res) => {
    const { city } = req.query; 

    if (!isCityExist(city)) 
        return res.status(400).json({ message: "City name is required: getLocationFromCity" });
  
    try {
        const response = await fetchCoordinatesFromCity(city);

        if (!isResponseExist(response, res)) 
            return res.status(404).json({ message: "City not found." });

        const data = response.data;
        const latitude = data[0].lat;
        const longitude = data[0].lon;
        res.status(200).json({ lat: latitude, lon: longitude});

    } catch (error) {
        res.status(500).json({ message: "Failed to fetch location data.", error: error.message });
    }
};


const getWeatherReportFromCity = async (req, res) => {
    const { city } = req.query;
    const userId = req.user.id;

    if (!isCityExist(city)) 
        return res.status(400).json({ message: "City name is required: getWeatherReportFromCity" });
    
    try {
        const existingQuery = await cacheHitWeatherQueryDB(city, userId);

        if (existingQuery) {
            return res.status(200).json({
                cached: true,
                city: existingQuery.city,
                forecast: existingQuery.forecast.forecast, // access nested forecast array
            });

        } else {
            // If there is no entry in the database for City:Data 
            const geoResponse = await fetchCoordinatesFromCity(city);
            if (!isResponseExist(geoResponse)) 
                return res.status(404).json({ message: "City not found." });
            
            const geoData = geoResponse.data;
            const lat = geoData[0].lat;
            const lon = geoData[0].lon;

            // Second: Get weather report from lat/lon
            const weatherResponse = await fetchWeatherFromCoordinate(lat, lon);
            const forecastList = weatherResponse.data.list;
            const simplifiedForecast = simplifyForecastList(forecastList);
            const count = simplifiedForecast.length;

            await saveWeatherQueryDB({city, userId, simplifiedForecast});
            return res.status(200).json({ city, forecast: simplifiedForecast });
        }

    } catch (error) {
        return res.status(500).json({ message: "Failed to get weather report.", error: error.message,});
    }
};


const getQueryHistory = async (req, res) => {
    try {
        const { username } = req.query;
        const role = req.user.role;
        const requesterId = req.user.id;
        
        if (!isUsernameExist(username)) 
            return res.status(400).json({ message: "Missing 'username' in query." });
        
        // Fetch the user by username
        const targetUser = await findUserByUsernameDB(username);

        if (!isTargetExist(targetUser)) 
            return res.status(404).json({ message: "User not found." });
        
        // Access check: if not the same user and not admin, deny access
        if (!isIDMatch(targetUser.id, requesterId) && !isAdmin(role)) 
            return res.status(403).json({ message: "Access denied: Only admin can access other users' history.",});
        
        // Get weather queries for that user
        const queries = await findWeatherQueriesByUserDB(requesterId);
        return res.status(200).json({ username, count: queries.length, history: queries });

    } catch (error) {
        return res.status(500).json({
            message: "Failed to get query history.",
            error: error.message,
        });
    }
};

// Export
module.exports = {getLocationFromCity, getWeatherReportFromCity, getQueryHistory};