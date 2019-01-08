const tripQueries = require('../queries/trip-query');
const {skipFieldsCreator} = require('../../util-module/request-validators');

const fetchTripDetailsAccessor = async (req) => {
    let returnObj;
    returnObj = await tripQueries.fetchTripDetailsQuery(req);
    return returnObj;
};
const getActiveTripDetailsByContainerIdAccessor = async (req) => {
    let returnObj;
    returnObj = await tripQueries.getActiveTripDetailsByContainerIdQuery(req);
    return returnObj;
};

const getNotificationEmailsForTripIdAccessor = async (req) => {
    let returnObj;
    returnObj = await tripQueries.getNotificationEmailsForTripIdQuery(req);
    return returnObj;
};

const updateTripStatusAccessor = async (req) => {
    let returnObj, newReq = {};
    newReq['tripId'] = req.tripId;
    newReq['setFields'] = skipFieldsCreator(req, 'tripId');
    returnObj = await tripQueries.updateTripStatusQuery(newReq);
    return returnObj;
};

const fetchNextElockTripPrimaryKeyAccessor = async () => {
    let returnObj;
    returnObj = await tripQueries.fetchNextElockTripPrimaryKeyQuery();
    return returnObj;
};


const insertElockTripDataAccessor = async (req) => {
    let returnObj;
    returnObj = await tripQueries.insertElockTripDataQuery(req);
    return returnObj;
};

module.exports = {
    fetchTripDetailsAccessor,
    insertElockTripDataAccessor,
    getActiveTripDetailsByContainerIdAccessor,
    getNotificationEmailsForTripIdAccessor,
    updateTripStatusAccessor,
    fetchNextElockTripPrimaryKeyAccessor
};