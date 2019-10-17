const AxeBuilder = require('axe-webdriverjs');
const WebDriver = require('selenium-webdriver');
const Excel = require('exceljs');
const fs = require('fs');
const moment = require('moment');

// Main objects and helper functions

// I'm using a global object to store results.
// If necessary, shame me into implementing a better pattern.
let gResultsTotal = [];

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
const crawlList = readJSON('./crawl-list.json');

// Kick-off of main process

const startProcess = async (crawlList) => {

  // TO-DO fix this (axeConfig is not being correctly parsed)
  await axebuilder.configure(axeConfig);

  // Temporary hardcoded solution
  axebuilder.withTags(['wcag2a', 'wcag2aa', 'section508', 'best-practice']);

  // Iterate through URLs
  const urlNames = getUrlNames(crawlList);
  const urlLinks = getUrlLinks(crawlList);
  
  const listEnd = urlLinks.length - 1;
  let index = 0;

  //for .. of ensures sync iteration (instead of .forEach)
  for (const pageUrl of urlLinks) { 

    let pageName = urlNames[index];

    await analyzePage(pageUrl, pageName);

    if (index === listEnd) {
      driver.quit();
      handleOutput();
    }
    index++;
  }
}

startProcess(crawlList);

// RELOCATE
//const urlLinks = getUrlLinks(crawlList);
//const urlNames = getUrlNames(crawlList);

const getUrlLinks = (crawlList) => {
  let urlLinks = [];
  crawlList.forEach( (site) => urlLinks.push(site.url) );
  return urlLinks;
}
const getUrlNames = (crawlList) => {
  let urlNames = [];
  crawlList.forEach( (site) => urlNames.push(site.name) );
  return urlNames;
}


//TO-DO compare output of a single page w/ axe-core extension

const analyzePage = async (url, name) => {
  await driver
    .get(url)
    .then(() => handleDriverGet(url, name));
  return true;
};

const handleDriverGet = async (url, name) => {
  await axebuilder.analyze((err, results) => {
    return handleAnalysis(err, results, url, name);
  });
  return true;
}

const handleAnalysis = (err, results, url, name) => {
  if (err) {
    throw err;
  }
  
  // We add custom keys to the results (not native to axe)
  results['urlSectionName'] = name;

  // Push results to the global object
  gResultsTotal.push(results);
  return true;
}

const writeRawJson = () => {

  const date = moment().format("YYYY-MM-DD__HH-mm-ss");
  const outputJSON = JSON.stringify(gResultsTotal, null, 2);

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
    .writeFile('./output/' + filename + ".xlsx")
    .then(function () {
      console.log("Done writing XLSX");
    });

}


const handleOutput = () => {
  // Generate Json
  writeRawJson();

  // Generate excel
  let rows = fmtJsonAsRows(gResultsTotal);
  writeExcel(rows, 'test');
}

const fmtJsonAsRows = (rawJson) => {

  let violationsAll = [];
  let reportMode = "detailed"; // overview | detailed

  rawJson.forEach(website => {
    // returns [ [col1, col2, col3], [col1, col2, col3] ]
    let violationsRows = mapViolations2Rows(
      reportMode,
      website['violations'],
      website['url'],
      website['urlSectionName'], // added manually
    );

    violationsAll = violationsAll.concat(violationsRows);
  });

  let columnNames = [];
  switch (reportMode) {
    case "detailed":
      columnNames = ['Section', 'URL', 'Error ID', 'Impact', 'Occurrences', 'Description', 'Target', 'HTML'];
      break;
    case "overview":
      columnNames = ['Section', 'URL', 'Error ID', 'Impact', 'Occurrences', 'Description'];
      break;
  }

  violationsAll.unshift(columnNames);
  //console.dir(violationsAll, { depth: null });

  return violationsAll;

}

const mapViolations2Rows = (reportMode, axeViolations, urlSite, urlName) => {

  let rows = [];
  if
    (reportMode == "overview") {
    rows = fmtRowsOverview(axeViolations, urlSite, urlName);
  } else if
    (reportMode == "detailed") {
    rows = fmtRowsDetailed(axeViolations, urlSite, urlName);
  }

  //console.log(rows);

  return rows;
}

const fmtRowsOverview = (axeViolations, urlLink, urlName) => {

  let rows = [];

  axeViolations.forEach((axeItem) => {
    let row = [
      urlName,                      // Section
      urlLink,                      // URL
      axeItem['help'],              // Error ID
      mapImpact(axeItem['impact']), // Impact
      axeItem['nodes'].length,      // Occurrences
      axeItem['description'],       // Description
    ];
    rows.push(row);
  });

  return rows;
}


const fmtRowsDetailed = (axeViolations, urlLink, urlName) => {

  let rows = [];

  axeViolations.forEach((axeItem) => {

    // Parent format
    let rowTpl = [
      urlName,                      // Section
      urlLink,                      // URL
      axeItem['help'],              // Error ID
      mapImpact(axeItem['impact']), // Impact
      axeItem['nodes'].length,      // Occurrences
      axeItem['description'],       // Description
    ];

    axeItem['nodes'].forEach((axeItemNode) => {
      let row = rowTpl.concat(
        axeItemNode['target'], // Target
        axeItemNode['html'],   // HTML
      );
      rows.push(row);
    });

  });

  return rows;
}

// To make impact sortable
const mapImpact = (impactStr) => {
  let returnStr = '';
  switch (impactStr) {
    case "minor":
      returnStr = "1 - Minor";
      break;
    case "moderate":
      returnStr = "2 - Moderate";
      break;
    case "serious":
      returnStr = "3 - Serious";
      break;
    case "critical":
      returnStr = "4 - Critical";
      break;
  }
  return returnStr;
}