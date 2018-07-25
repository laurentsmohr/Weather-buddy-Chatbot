const app = require('express')();
const axios = require('axios');
const bodyParser = require('body-parser');
const morgan = require('morgan');

app.use(bodyParser.json());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 8000;

const urls = {
  getWoeid: 'https://www.metaweather.com/api/location/search/?query=',
  getWeather: 'https://www.metaweather.com/api/location/',
};

const dialogflowResponse = {
  fulfillmentText: '',
};

app.post('/weather', (request, response) => {
  let query = request.body.queryResult;
  let followUp = false;
  console.log('query', query);
  console.log('context', query.outputContexts);
  let date;
  let cityName;
  // if(query.intent.displayName === 'Celsius follow up') {
  //   followUp = true;
  //   cityName = query.parameters['geo-city'] || query.outputContexts[0].parameters['geo-city'];
  //   date = query.parameters['date'] || query.outputContexts[0].parameters['date'];
  // } else {
  //   cityName = request.body.queryResult.parameters['geo-city'];
  //   date = request.body.queryResult.parameters['date'];
    // if(cityName === '') {
    //   dialogflowResponse.fulfillmentText = 'What city do you want to know the weather for?';
    //   response.json(dialogflowResponse);
    //   return;
    // }
  // }
  
  cityName = query.parameters['geo-city'] || query.outputContexts[0].parameters['geo-city'];
  date = query.parameters['date'] || query.outputContexts[0].parameters['date'];
  if(cityName === '') {
    dialogflowResponse.fulfillmentText = 'What city do you want to know the weather for?';
    response.json(dialogflowResponse);
    return;
  }

  if(date) {
    date = date.substring(0, 10);
  }
  // where on earth id
  let woeid;

  // query metaweather api to get woe id for that city
  axios.get(urls.getWoeid + cityName)
    .then(res => {
      // use woeid to get temperature
      return woeid = res.data[0].woeid;
    })
    .then(woeid => axios.get(urls.getWeather + woeid))
    .then(res => {
      
      //  match date given by user to entry in api response
      let dateIndex;
      if (date === '') {
        dateIndex = 0;
      } else {
        for(let i = 0; i < res.data.consolidated_weather.length; i++) {
          if(res.data.consolidated_weather[i].applicable_date === date) {
            dateIndex = i;
            break;
          }
        }          
      }
      if(dateIndex === undefined) {
        dialogflowResponse.fulfillmentText = 'Could not find forecasts for the given date';
        response.json(dialogflowResponse);
        return;
      }
      

      let celsius = res.data.consolidated_weather[dateIndex].the_temp;
      let state = res.data.consolidated_weather[dateIndex].weather_state_name;
      let stateCode = res.data.consolidated_weather[dateIndex].weather_state_abbr;
      let wind = res.data.consolidated_weather[dateIndex].wind_speed;
      // convert to fahrenheit
      let fahrenheit = celsius * ((9/5)) + 32;

      // round to 2 decimal places
      fahrenheit = Math.round(fahrenheit * 100) / 100;
      celsius = Math.round(celsius * 100) / 100;

      let tense = dateIndex === 0 ? 'is' : 'will be';

      if(request.body.queryResult.intent.displayName === 'Celsius follow up') {
        dialogflowResponse.fulfillmentText = `No problem! ${fahrenheit} degrees Fahrenheit converts to ${celsius} degrees Celsius.`
      } else {

        dialogflowResponse.fulfillmentText = 
          `The average temperature for ${cityName} ${tense} ${fahrenheit} degrees Fahrenheit. The forecast predicts ${state}`;

        if(stateCode === 'hc' || stateCode === 'lc') {
          dialogflowResponse.fulfillmentText += 's.';
        }
        else if (stateCode === 'c') {
          dialogflowResponse.fulfillmentText += ' Sky.';
        }
        else {
          dialogflowResponse.fulfillmentText += '.';
        }

        if(wind > 17) {
          dialogflowResponse.fulfillmentText += '\nPlease be prepared for strong winds!'
        }
      }

      response.json(dialogflowResponse);
    })
    .catch(err => {
      console.log(err);
      let errorResponse = `Oops! The model hasn't been trained fo this request yet. Please try a different query!`;
      dialogflowResponse.fulfillmentText = errorResponse;
      response.json(dialogflowResponse);
    });
});

app.listen(PORT, () => console.log(`Weather-buddy listening on port ${PORT}`));