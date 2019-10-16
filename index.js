const AxeBuilder = require('axe-webdriverjs');
const WebDriver = require('selenium-webdriver');
const fs = require('fs');
const moment = require('moment');

// Main objects and helper functions

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
const urlList   = readJSON('./url-list.json');

// Main process kickoff

let resultsTotal = [];

const startProcess = async () => {

  // TO-DO fix this (axeConfig is not being correctly parsed)
  await axebuilder.configure(axeConfig);
  // Temporary hardcoded solution
  axebuilder.withTags(['wcag2a', 'wcag2aa', 'section508', 'best-practice']);

  // Iterate through URLs
  const listEnd = (urlList.length-1);
  urlList.forEach( async (url, index) => {
    await analyzePage(url);

    // If we reach the end of the list
    if (index === listEnd) {
      driver.quit();
      generateOutput();
    }
  });

}

startProcess();

//TO-DO compare output of a single page w/ axe-core extension

const analyzePage = async (url) => {
  await driver
    .get(url)
    .then(() => handleDriverGet(url));
};

const handleDriverGet = async (url) => {
  await axebuilder.analyze((err, results) => {
    handleAnalysis(err, results, url)
  });
}

const handleAnalysis = (err, results, url) => {
  if (err) {
    throw err;
  }
  //console.log("----------------------------------------");
  //console.log("results from " + url);
  //console.dir(results, { depth: null});

  resultsTotal.push(results);
}

const generateOutput = () => {

  const date = moment().format("YYYY-MM-DD__HH-mm-ss");
  const outputJSON = JSON.stringify(resultsTotal, null, 2);

  fs.writeFileSync(`./output/${date}.json`, outputJSON);
  
}