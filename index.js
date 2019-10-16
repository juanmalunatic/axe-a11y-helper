const AxeBuilder = require('axe-webdriverjs');
const WebDriver = require('selenium-webdriver');
const Excel = require('exceljs');
const fs = require('fs');
const moment = require('moment');

// Main objects and helper functions

// I'm using a global object to store results.
// If necessary, shame me into implementing a better pattern.
let resultsTotal = [];

const driver = new WebDriver.Builder()
  .forBrowser('chrome')
  .build();

const axebuilder = AxeBuilder(driver);

const readJSON = (filename) => {
  return JSON.parse(
    fs.readFileSync(filename)
  );
}

// Read config and URLs from disk
const axeConfig = readJSON('./axe-settings.json');
const urlList = readJSON('./url-list.json');

// Kick-off of main process

const startProcess = async () => {

  // TO-DO fix this (axeConfig is not being correctly parsed)
  await axebuilder.configure(axeConfig);

  // Temporary hardcoded solution
  axebuilder.withTags(['wcag2a', 'wcag2aa', 'section508', 'best-practice']);

  // Iterate through URLs
  const listEnd = urlList.length - 1;
  let index = 0;

  for (const url of urlList) {
    await analyzePage(url);
    
    if (index === listEnd) {
      driver.quit();
      handleOutput();
      console.dir( resultsTotal, {depth: 1});
    }
    index++;
  }
}
startProcess();


//TO-DO compare output of a single page w/ axe-core extension

const analyzePage = async (url) => {
  await driver
    .get(url)
    .then(() => handleDriverGet(url));
  return true;
};

const handleDriverGet = async (url) => {
  await axebuilder.analyze((err, results) => {
    return handleAnalysis(err, results, url);
  });
  return true;
}

const handleAnalysis = (err, results, url) => {
  if (err) {
    throw err;
  }
  resultsTotal.push(results);
  return true;
}

const writeRawJson = () => {

  const date = moment().format("YYYY-MM-DD__HH-mm-ss");
  const outputJSON = JSON.stringify(resultsTotal, null, 2);

  fs.writeFileSync(`./output/${date}.json`, outputJSON);

}


const writeExcel = (rows, filename) => {

  var workbook = new Excel.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = true;

  var sheet = workbook.addWorksheet('MainSheet');
  var worksheet = workbook.getWorksheet('MainSheet');

  worksheet.addRows(rows);

  // Temporarily write from memory. Use streams for large files.
  workbook.xlsx
    .writeFile(filename)
    .then(function () {
      console.log("Done writing XLSX");
    });

}


const handleOutput = () => {
  // Generate Json
  // writeRawJson();

  // Generate excel
  let rows = fmtJsonAsRows(resultsTotal);
  // writeExcel(rowsArray, filename);
}

const fmtJsonAsRows = (rawJson) => {

  let violationsAll = [];

  rawJson.forEach(website => {
    violationsSite = [];
    violationsSite.push(
      mapViolations2Rows(website['violations'], website['url'])
    )
    violationsAll.push(violationsSite);
  });

  // We're only interested on violations atm
  // console.dir(violationsAll, {depth: null});
}

const mapViolations2Rows = (axeViolations, urlSite) => {

  let rows = [];

  axeViolations.forEach((axeItem) => {

    // TO-DO node info

    let row = [
      urlSite,                 // Section
      axeItem['help'],         // Error ID
      axeItem['impact'],       // Impact
      axeItem['nodes'].length, // Occurrences
      axeItem['description'],  // Description
    ];

    rows.push(row);

  })

  return rows;
}