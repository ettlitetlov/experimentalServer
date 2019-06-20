const express = require('express');
const sharp = require('sharp');
var Client = require('ftp');
const zlib = require('zlib');

/* Part under construction
require("@babel/register")({
  presets: ["@babel/preset-env"]
});

import { Fits, Hdu } from "@hscmap/fits";
*/

// Reading FITS?

// Auxiliary for external requests
var request = require('request');
const fs = require('fs');

const app = express()
const port = 3000

// Allowing CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if(req.method === 'OPTIONS'){
      res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE,');
      return res.status(200).json({});
  }
  next(); 
});


// Defualt endpoint, delivers sunimages from SDO
app.get('/', function (req, res) {


  /*
  // CygnetID;
  const id = 237

  // Time information specific for iSWA
  let currentTime = new Date().toLocaleString().split(/(\D+)/);

  if(currentTime[2].length < 2){
    currentTime[2] = 0 + currentTime[2];
  }
  currentTime[5] = "%20";

  const formattedTime = currentTime.join('');
  const URL = `https://iswa.gsfc.nasa.gov/IswaSystemWebApp/iSWACygnetStreamer?timestamp=${formattedTime}&window=-1&cygnetId=${id}&width=2048&height=2048`;
  const sdoURL = "https://sdo.gsfc.nasa.gov/assets/img/browse/2019/04/26/20190426_001146_4096_0171.jpg";
  console.log(URL);
  request.get(sdoURL)
    .on('response', function(response){
      console.log('Request in: ' + 'ROOT, ' +'StatusCode:', response && response.statusCode, " at: " + new Date().toString()); // Print the response status code if a response was received
      console.log(response.headers['content-type'])
  })
  .pipe(fs.createWriteStream('sun.jpg').on('close', () =>{
    sharp('sun.jpg') 
    .jpeg({
      quality: 100})
    .extend({
      top: 0,
      bottom: 0,
      left: 2048,
      right: 2048,
      background: { r: 0, g: 0, b: 0, alpha: 1 }})
      .toFile('output.jpg')
      .then(() => {
        res.sendFile(__dirname + "\\output.jpg");
      })
  })); 
  */

  setTimeout(function () { return res.send("You are at ROOT")},3000);
  
})


// Get a random FITS image 
app.get('/getmeafitsimage', (req,res,next) => {
  const fitsDir = './FITSdata';
  let listOfFiles = [];
  if(fs.existsSync(fitsDir)){
    fs.readdirSync(fitsDir).map(subDir => {
      try{
        fs.readdirSync(`${fitsDir}/${subDir}`).map(file => {
          listOfFiles.push(__dirname + `/FITSdata/${subDir}/${file}`);
        })
      }
      catch(err){
        console.log(err);
      }
    })
    const fileString = listOfFiles[Math.floor(Math.random()*listOfFiles.length)];
    res.download(fileString, fileString.substring(fileString.length - 33));
  }
  else{
    res.send("No FITS image found");
  }
})

// Get the next fits image that does exist
app.get('/getmenextfitsimage/:time/:dir', (req,res,next) => {
  
  // OpenSpace browsing time, formated: YYYYMMDDHHmm
  const currentTime = 'mrzqs' + req.params.time.substring(2);
  let time = new Date();
  // If you want to log
  //console.log(time.getUTCDate() + "/" + (time.getUTCMonth()+1) + " " + (time.getUTCHours()-4) + ":" + time.getUTCMinutes() + "." + time.getUTCSeconds() + " GET-Request at: /getmenextfitsimage/" + currentTime);
  //Should be either forward or backwards
  const direction = req.params.dir;
  let once = 0;
  const fitsDir = './FITSdata';
  if(fs.existsSync(fitsDir)){
    let found = false;
    let foundDay = false;
    fs.readdirSync(fitsDir).map(existingDays => {
      let nextImage;
      let leastDifference = 9999;
      if(existingDays == currentTime.substring(0,currentTime.length-4)){
        foundDay = true;
        fs.readdirSync(fitsDir + '/' + existingDays + '/').map(existingTimes => {
          let numbersFromString = existingTimes.substring(5,11) + existingTimes.substring(12,16);
          let diff = parseInt(numbersFromString) - parseInt(currentTime.substring(5))
          if(direction < 0 && -leastDifference < diff < 0 ){
            leastDifference = diff;
            nextImage = existingTimes;
            found = true;
          }
          else if(direction > 0 && 0 < diff && diff < leastDifference){
            leastDifference = diff;
            nextImage = existingTimes;
            found = true;
          }
        })
        if(found){
          once++;
          return res.send(nextImage);
        } 
      }
      else if(!found && foundDay && direction > 0){
        foundDay = false;
        fs.readdirSync(fitsDir + '/' + existingDays + '/').map(existingTimes => {
          if(once == 0){
            once++;
            return res.send(existingTimes);
          }
        })
      }
    })
  }
  else{
    return res.send('Not found!');
  }

  if(once < 1){
    return res.send('Not found!')
  }

})

// Returns a specific if if it does exist expects format xxxxxYYMMDDtHHmmcxxxx_xxx
app.get('/get/:name', (req,res) => {
  const want = req.params.name;
  let time = new Date();
  // Logging
  //console.log(time.getUTCDate() + "/" + (time.getUTCMonth()+1) + " " + (time.getUTCHours()-4) + ":" + time.getUTCMinutes() + "." + time.getUTCSeconds() +" GET-Request at: /get/" + want);
  const fitsDir = './FITSdata';
  let found = false;

  if(fs.existsSync(fitsDir + '/' + want.substring(0,11))){
    fs.readdirSync(fitsDir + '/' + want.substring(0,11) + '/').map(toFind => {
      if(toFind.substring(0,16) == want.substring(0,16)){
        found = true;
        return res.sendFile(fitsDir + '/' + want.substring(0,11) + '/' + toFind, { root : __dirname}); 
      }
    })
  }

  if(!found){
    return res.send('No such file in database')
  }
  
})

// Testing for getting FITS-data from GONG's website.
// DISABLED FOR NOW, SO we dont fetch it again, the ftp server is real slow
// Estimated time you ask, about 30 minutes for 30 days.

app.get('/ftpTest/:num?', (req,res,next) => {
  var c = new Client()
  var cProperties = {
    host: "gong2.nso.edu"
  }
  
  let numberOfDays = 30;

  if(req.params.num)
    numberOfDays = req.params.num;

  console.log(numberOfDays);

  let today = new Date();
  let dateYYYYMM = today.getFullYear().toString() + "0" + (today.getMonth() + 1).toString();
  let listOfThirtyEntries = [];
  
  c.connect(cProperties);

  console.log("Connected!");

  c.list(`QR/zqs/${dateYYYYMM}`, (err, list) => {
    if(err)
      res.send("error: " + err);
    else{
      // This little things is to read the last entry first
      list.reverse().map( index => {
          if(listOfThirtyEntries.length < numberOfDays)
            listOfThirtyEntries.push(index.name);
      })
      listOfThirtyEntries.reverse();
      if(!fs.existsSync(`./FITSdata/`))
        fs.mkdirSync(`./FITSdata/`);
    }
    if(listOfThirtyEntries.length < numberOfDays){
      const prevIndex = getPreviousMonth(dateYYYYMM);
      dateYYYYMM = prevIndex;
      let prevMonth = [];
      c.list(`QR/zqs/${prevIndex}`, (subErr, subList) => {
        if(subErr){
          res.send("error: " + subErr)
        }
        else{
          subList.map( subIndex => {
            prevMonth.push(subIndex.name);
          })
          while(prevMonth.length > 0 && listOfThirtyEntries.length < numberOfDays){
            listOfThirtyEntries.unshift(prevMonth.pop());
          }
          fetchFTPfiles(c,listOfThirtyEntries);
        }
      })
    }
    else{
      fetchFTPfiles(c,listOfThirtyEntries);
    }
  })
})

// Get available field lines
app.get('/WSA/available', (req,res,next) => {

  let set = [];
  const wsaPath = './WSAdata/';
  if(fs.existsSync(wsaPath)){

    if(fs.existsSync(wsaPath + 'PfssIo/') && fs.existsSync(wsaPath + 'PfssOi/') && fs.existsSync(wsaPath + 'ScsOi/')){
      // Picking up random field line set from Pfss OI, using it to choose the other sets.
      fs.readdirSync(wsaPath + 'PfssOi').map((data) => {
        set.push('PfssOi/' + data);    
      });

      fs.readdirSync(wsaPath + 'PfssIo').map((data) => {
        set.push('PfssIo/' + data);    
      });

      fs.readdirSync(wsaPath + 'ScsOi').map((data) => {
        set.push('ScsOi/' + data);    
      });
      return res.send(set);
    }
    else{
      return res.send("Dataset not complete");
    }
  }
  else{
    return res.send("No data found");
  }
})

// Get a specific field line given the time
// EX: PfssOistep25_2019-05-02T19-59-57.120.osfls
// Time expected like this: YYYY-MM-DDThh:mm:ssZ same as global::timeManager.time().ISO8601() in openspace
app.get('/WSA/:FL/:time?', (req,res,next) => {
  // If user ask for a timestep, we will modify the field lines to be applicable in 2h in the future of that time.
  let time = "";
  if(req.params.time)
    time = req.params.time;
  let found = false;
  const fieldLine = req.params.FL;
  const wsaPath = './WSAdata/';

  fs.readdirSync(wsaPath + fieldLine.substring(0,6) + '/').map(file => {
    if(file == fieldLine.substring(6,fieldLine.length) && time.length == 0){
      found = true;
      return res.download(wsaPath + fieldLine.substring(0,6) + '/' + file);
    }
    else if(file == fieldLine.substring(6,fieldLine.length)){
      let date = new Date(time.substring(0,4), parseInt(time.substring(5,7))-1, time.substring(8,10), time.substring(11,13), time.substring(14,16), time.substring(17,19),00);
      date.setTime(date.getTime());
      let newTime = date.toISOString();
      found = true;
      return res.download(wsaPath + fieldLine.substring(0,6) + '/' + file, fieldLine.substring(6,13) + newTime.substring(0,newTime.length - 1));
    }

  })

  if(!found){
    return res.send("No such file in directory.");
  }

})

// Endpoint to delete the directory with all fitsdata
app.get('/deleteAllFrknData', (req,res,next) => {
  fs.rmdirSync('FITSdata', (err) => {
    if(err) res.send("error: " + err);
    else res.send("All has been deleted");
  })
})

// Unzip .gz files, note that this handles all .gz files in the directory, not recursive though 
function unzipDirInPlaceAsync(dir){
  console.log("Starting to unzip");
  return new Promise((resolve, reject) => {
    if(!fs.existsSync(dir)){
      reject("File path not found")
    }
    else{
      console.log("Found directory");
      const directoryFiles = fs.readdirSync(dir);
      directoryFiles.map(fileName => {
        const fileContents = fs.createReadStream(`${dir}/${fileName}`);
        const writeStream = fs.createWriteStream(`${dir}/${fileName.slice(0,-3)}`);
        const unzip = zlib.createGunzip();
        fileContents.pipe(unzip).pipe(writeStream).on('finish', (err) => {
          if(err) return reject(err);
          else{
            fs.unlink(`${dir}/${fileName}`, (errUn) => {
              if (errUn) return reject(errUn)     
              resolve("Success");
            })
          } 
        })
      })
    }
  });
}


function fetchFTPfiles(c,listOfDays){
  let monthlyObject = Object.assign({}, listOfDays);
  console.log(listOfDays);
  let counter = 0;
  for(var it in monthlyObject){
    const val = monthlyObject[it];
    const parentDir = "20" + Math.floor(parseInt(val.match(/[0-9]+/g))/100);
    //console.log(parentDir, val);
    c.list(`QR/zqs/${parentDir}/${val}`, (hErr, hours) => {
      if(hErr) res.send(hErr)
      else{
        monthlyObject[it] = {
          "day": val,
          "timeSteps": []
        }
        hours.map(hIndex => {
          monthlyObject[it].timeSteps.push(hIndex.name);
          c.get(`QR/zqs/${parentDir}/${val}/${hIndex.name}`, (getError, stream) =>{
            if (getError) throw getError;
            if(!fs.existsSync(`./FITSdata/${val}`))
              fs.mkdirSync(`./FITSdata/${val}`);
            stream.once('close', function() { c.end(); });
            stream.pipe(fs.createWriteStream(`FITSdata/${val}/${hIndex.name}`));
          })
        })
      }
    })
    
    if(counter == listOfDays.length){
      res.send("Donezo!")
    }
    else{
      counter++;
    }
  }

}

// Code snippet to unzip and remove all .gz files from the directory
// const directory = fs.readdirSync('./FITSdata/');
// directory.map( file => {
//   unzipDirInPlaceAsync(`./FITSdata/${file}`)
//   .then(console.log("Finished with folder: ", file))
//   .catch(err => {
//     console.log(err);
//   });
// })


// Fetch previous month
function getPreviousMonth(currMonth){
  let intMonth = parseInt(currMonth)%100;

  if(intMonth == 1){
    let year = parseInt(currMonth)%10000;
    year = year -1;
    return "20".concat('', [year.toString(), "12"]);
  }
  else{
    return (parseInt(currMonth) - 1).toString();
  }
  
}


app.listen(port, () => console.log(`Example app listening on port ${port}!`))