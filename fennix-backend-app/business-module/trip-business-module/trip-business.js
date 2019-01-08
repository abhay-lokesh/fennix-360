const tripAccessors = require('../../repository-module/data-accesors/trip-accessor');
const containerAccessors = require('../../repository-module/data-accesors/container-accessor');
const userAccessors = require('../../repository-module/data-accesors/user-accesor');

const startTripBusiness = async (req) => {
    let response, notificationsResponse;
    notificationsResponse = await tripAccessors.getNotificationEmailsForTripIdAccessor({tripId: req.query.tripId});
    if (notNullCheck(notificationsResponse)) {
        containerAccessors.setContainerLockStatusAccessor([parseInt(notificationsResponse[0].containerId), true]);
        tripAccessors.updateTripStatusAccessor({
            tripId: req.query.tripId,
            tripStatus: 'IN_PROGRESS',
            tripActualStartTime: new Date()
        });
        // activePasswordResponse[0]['active_password']
        // const activePasswordResponse = await tripAccessors.getActivePasswordForContainerIdAccessor([notificationsResponse.containerId]);
        // if (objectHasPropertyCheck(activePasswordResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(activePasswordResponse.rows)) {
        socket.socketIO.emit('set_active_password', {
            newPassword: '100000',
            oldPassword: '100000'
        });
        // }
        notificationEmailBusiness(notificationsResponse[0].notificationEmail1, 'start_trip');
        notificationEmailBusiness(notificationsResponse[0].notificationEmail2, 'start_trip');
        notificationEmailBusiness(notificationsResponse[0].notificationEmail3, 'start_trip');
    }
    return fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', '');
};

const getTripStatusName = (tripStatus) => {
    const tripStatusMap = {NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed'};
    return tripStatusMap[tripStatus];
};
const endTripBusiness = async (req) => {
    let response, notificationsResponse;
    notificationsResponse = await tripAccessors.getNotificationEmailsForTripIdAccessor({tripId: req.query.tripId});
    if (notNullCheck(notificationsResponse)) {
        let startDateTime = new Date(notificationsResponse[0]['tripActualStartTime']);
        let endDateTime = new Date();
        let tripDuration = Math.abs(endDateTime.getTime() - startDateTime.getTime());
        tripAccessors.updateTripStatusAccessor({
            tripId: req.query.tripId,
            tripStatus: 'COMPLETED',
            tripActualEndTime: endDateTime,
            tripActualDuration: tripDuration
        });
        notificationEmailBusiness(notificationsResponse[0].notificationEmail1, 'end_trip');
        notificationEmailBusiness(notificationsResponse[0].notificationEmail2, 'end_trip');
        notificationEmailBusiness(notificationsResponse[0].notificationEmail3, 'end_trip');
    }
    return fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', '');
};
const fetchCompletedTripDetailsBusiness = async (req) => {
    let userRequest = {query: {userId: req.query.userId, languageId: req.query.languageId}}, request = {},
        mongoRequest = {status: ["COMPLETED"], containerId: {$in: []}},
        tripResponse;
    tripResponse = await commonFetchTripDetails(userRequest, mongoRequest, request);
    return fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', tripResponse);
};

const commonFetchTripDetails = async (userRequest, mongoRequest, request) => {
    let containerListResponse, response, tripResponse = {gridData: []};
    let userResponse = await userAccessors.getUserIdsForAllRolesAccessor(userRequest, COMMON_CONSTANTS.FENNIX_USER_DATA_MODIFIER_USER_USERID_NATIVE_ROLE);
    request.userIdList = userResponse.userIdsList;
    request.nativeUserRole = userResponse.nativeUserRole;
    containerListResponse = await containerAccessors.getContainerIdListAccessor(request);
    if (objectHasPropertyCheck(containerListResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(containerListResponse.rows)) {
        containerListResponse.rows.forEach((item) => {
            mongoRequest.containerId.$in.push(item['container_id']);
        });
        response = await tripAccessors.fetchTripDetailsAccessor(mongoRequest);
        if (arrayNotEmptyCheck(response)) {
            let formattedArray = [];
            response.forEach((item) => {
                const obj = {
                    tripId: item['tripId'],
                    tripName: item['tripName'],
                    tripStartAddress: item['startAddress']['name'],
                    tripEndAddress: item['endAddress']['name'],
                    tripStartTime: item['startDate'],
                    tripEndTime: item['endDate'],
                    tripStatus: getTripStatusName(item['tripStatus']),
                    tripDuration: item['tripDuration'] ? item['tripDuration'] : '-',
                    tripActualStartDateTime: item['actualStartDate'] ? item['actualStartDate'] : '-',
                    tripActualEndDateTime: item['actualEndDate'] ? item['actualEndDate'] : '-',
                    tripActualDuration: item['actualDuration'] ? item['actualDuration'] : '-'
                };
                formattedArray.push(obj);
            });
            tripResponse.gridData = formattedArray;
            tripResponse.totalNoOfRecords = response.length;
        }
    }
    return tripResponse;
};

const fetchTripDetailsBusiness = async (req) => {
    let userRequest = {query: {userId: req.query.userId, languageId: req.query.languageId}}, request = {},
        mongoRequest = {status: ["IN_PROGRESS", "NOT_STARTED"], containerId: {$in: []}},
        tripResponse;
    tripResponse = await commonFetchTripDetails(userRequest, mongoRequest, request);
    return fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', tripResponse);
};

module.exports = {
    fetchTripDetailsBusiness,
    startTripBusiness,
    fetchCompletedTripDetailsBusiness,
    endTripBusiness
};