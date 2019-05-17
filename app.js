const express = require('express')
const sharp = require('sharp')
var Client = require('ftp');
const zlib = require('zlib');

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
    res.sendFile(fileString);
  }
  else{
    res.send("No FITS image found");
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