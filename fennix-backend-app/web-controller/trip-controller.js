var express = require('express');
var router = express.Router();
const tripBusiness = require('../business-module/trip-business-module/trip-business');

router.get('/listActiveTrip', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchTripDetailsBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});
router.post('/editTripData', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.editTripBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/tripDataByTripId', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchTripDetailsByTripIdBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});


router.get('/startTrip', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.startTripBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/getCompleteTripDetails', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchCompleteDeviceDetailsByTripIdBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/endTrip', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.endTripBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});
router.get('/listCompletedTrip', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchCompletedTripDetailsBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/getTripDetails', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchCompleteDeviceDetailsByTripIdBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/listNotStartedTrip', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.fetchNotStartedTripDetailsBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

router.get('/tripAggregator', function (req, res) {
    let returnObj;
    returnObj = tripBusiness.tripStatusAggregatorBusiness(req);
    returnObj.then((response) => {
        res.send(response);
    })
});

module.exports = router;