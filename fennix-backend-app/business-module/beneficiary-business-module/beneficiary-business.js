const beneficiaryAccessor = require('../../repository-module/data-accesors/beneficiary-accesor');
const {objectHasPropertyCheck, deviceStatusMapper, arrayNotEmptyCheck, notNullCheck} = require('../../util-module/data-validators');
const {fennixResponse} = require('../../util-module/custom-request-reponse-modifiers/response-creator');
const {statusCodeConstants} = require('../../util-module/status-code-constants');
const {getUserIdsForAllRolesAccessor} = require('../../repository-module/data-accesors/user-accesor');
const {deviceBybeneficiaryQuery, getDeviceDetailsForListOfBeneficiariesAccessor} = require('../../repository-module/data-accesors/device-accesor');
const {imageStorageBusiness, uploadToDropboxBusiness, shareDropboxLinkBusiness, emailSendBusiness, getDropdownNameFromKeyBusiness, createDropboxFolderBusiness} = require('../common-business-module/common-business');
const {excelRowsCreator, excelColCreator} = require('../../util-module/request-validators');
const Excel = require('exceljs');
const {getCountryCodeByLocationIdAccessor} = require('../../repository-module/data-accesors/location-accesor');
const restrictionAccessor = require('../../repository-module/data-accesors/restriction-accesor');
const COMMON_CONSTANTS = require('../../util-module/util-constants/fennix-common-constants');
const {dropdownCreator} = require('../../util-module/custom-request-reponse-modifiers/response-creator');

const {updateDeviceWithBeneficiaryIdAccessor} = require('../../repository-module/data-accesors/device-accesor');
const beneficiaryAggregatorBusiness = async (req) => {
    let beneficiaryResponse, returnObj, userIdsList;
    userIdsList = await getUserIdsForAllRolesAccessor(req, COMMON_CONSTANTS.FENNIX_USER_DATA_MODIFIER_USER_USERID);
    beneficiaryResponse = await beneficiaryAccessor.getBenefeciaryAggregator({
        languageId: req.query.languageId,
        userIdList: userIdsList
    });
    if (objectHasPropertyCheck(beneficiaryResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(beneficiaryResponse.rows)) {
        let beneficiaryObj = {
            victim: {key: 'victims', value: '', color: '', legend: 'VICTIM'},
            offender: {key: 'offenders', value: '', color: '', legend: 'OFFENDER'},
        };
        //TODO: commented below to test the flow
        // if (beneficiaryResponse.rows.length === 1) {
        //     let propName = beneficiaryResponse.rows[0]['role_name'].toLowerCase();
        //     let propName2 = propName.toLowerCase() === 'victim' ? 'victim' : "offender";
        //     beneficiaryObj[propName]['value'] = beneficiaryResponse.rows[0]['count'];
        //     beneficiaryObj[propName2]['value'] = 0;
        // } else {
        beneficiaryResponse.rows.forEach((item) => {
            if (notNullCheck(item['role_name'])) {
                beneficiaryObj[item['role_name'].toLowerCase()]['value'] = item['count'];
            }
        });
        // }
        returnObj = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', beneficiaryObj);
    } else {
        returnObj = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return returnObj;
};

const getTimeZoneDetailsBusiness = async () => {
    let timeZoneIdList = {dropdownList: []}, timeZoneResponse, finalResponse;
    timeZoneResponse = await beneficiaryAccessor.getTimeZoneDetailsAccessor();
    if (objectHasPropertyCheck(timeZoneResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(timeZoneResponse.rows)) {
        timeZoneResponse.rows.forEach((item) => {
            timeZoneIdList.dropdownList.push(dropdownCreator(item['time_zone_id'], item['time_zone_name'], false));
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', timeZoneIdList);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_TIME_ZONE_DETAILS, 'EN_US', []);
    }
    return finalResponse;
};

const addBeneficiaryBusiness = async (req) => {
    let request = req.body, restrictionRequest, countryCode, response, primaryKeyResponse, imageUpload,
        restrictionRequestList = [], finalRestrictionObj;
    const date = new Date();
    const fullDate = `${date.getDate()}${(date.getMonth() + 1)}${date.getFullYear()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    request.createdDate = new Date();
    request.createdBy = request.userId;
    if (objectHasPropertyCheck(request, 'image')) {
        imageUpload = request.image;
        delete request.image;
    }
    // set the beneficiary to active if the beneficiary is not active
    request.isActive = notNullCheck(request.isActive) ? request.isActive : true;
    // getting country code for the given location id
    countryCode = await getCountryCodeByLocationIdAccessor([request.country]);
    countryCode = objectHasPropertyCheck(countryCode, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(countryCode.rows) && notNullCheck(countryCode.rows[0]['location_code']) ? countryCode.rows[0]['location_code'] : 'OO';
    countryCode = countryCode.indexOf('-') !== -1 ? countryCode.split('-')[1] : countryCode;
    request.documentId = `PAT${countryCode}J-${fullDate}`;
    response = await beneficiaryAccessor.addBeneficiaryAccessor(request);
    if (objectHasPropertyCheck(response, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(response.rows)) {
        const folderName = `BENEFICIARY_${response.rows[0]['beneficiaryid']}_${fullDate}`;
        const folderBasePath = `/pat-j/${countryCode}/${folderName}`;
        // adding image to the dropbox
        const fileLocations = await imageStorageBusiness(imageUpload, folderBasePath, folderName, true);
        if (notNullCheck(fileLocations) && notNullCheck(fileLocations.sharePath) && notNullCheck(fileLocations.folderBasePath)) {
            const newReq = {
                beneficiaryId: response.rows[0]['beneficiaryid'],
                image: fileLocations.sharePath,
                baseFolderPath: fileLocations.folderBasePath
            };
            let imageUpdateForBenIdResponse = await beneficiaryAccessor.updateBeneficiaryAccessor(newReq);
        }
        if (objectHasPropertyCheck(request, 'geoFence') && arrayNotEmptyCheck(request['geoFence'])) {
            request['geoFence'].forEach((item) => {
                let obj = {
                    restrictionName: item['mapTitle'],
                    restrictionType: item['mapRestrictionType'],
                    startDate: item['startDate'],
                    finishDate: item['finishDate'],
                    repeatRules: item['restrictionDays'],
                    onAlert: item['onAlert'],
                    isActive: true,
                    locationDetails: item['mapLocation']
                };
                restrictionRequestList.push(obj);
            });
            finalRestrictionObj = {
                beneficiaryId: response.rows[0]['beneficiaryid'],
                restrictions: restrictionRequestList
            };
            await restrictionAccessor.addLocationRestrictionAccessor(finalRestrictionObj);
        }
        const newRequest = {...request, ...{beneficiaryId: response.rows[0]['beneficiaryid']}};
        await beneficiaryAccessor.addFamilyInfoAccessor(newRequest);
        if (objectHasPropertyCheck(newRequest, 'cvCode') || objectHasPropertyCheck(newRequest, 'creditCard') || objectHasPropertyCheck(newRequest, 'startDate') || objectHasPropertyCheck(newRequest, 'expiryDate')) {
            await beneficiaryAccessor.addAccountingAccessor(newRequest);
        }
    }
    return fennixResponse(statusCodeConstants.STATUS_BENEFICIARY_ADDED_SUCCESS, 'EN_US', []);
};

const updateBeneficiaryBusiness = async (req) => {
    let response, primaryKeyResponse, restrictionRequest, finalResponse, imageUpload, countryCode, createFolderFlag,
        beneficiaryResponse, folderBasePath,
        profileName, restrictionRequestList = [], finalRestrictionObj;
    const request = {...req.body};
    if (objectHasPropertyCheck(request, 'image')) {
        imageUpload = request.image;
        delete request.image;
    }
    if (objectHasPropertyCheck(request, 'geoFence') && arrayNotEmptyCheck(request['geoFence'])) {
        request['geoFence'].forEach((item) => {
            let obj = {
                restrictionName: item['mapTitle'],
                restrictionType: item['mapRestrictionType'],
                startDate: item['startDate'],
                finishDate: item['finishDate'],
                repeatRules: item['restrictionDays'],
                onAlert: item['onAlert'],
                isActive: true,
                locationDetails: item['mapLocation']
            };
            restrictionRequestList.push(obj);
        });
        finalRestrictionObj = {
            beneficiaryId: request.beneficiaryId,
            restrictions: restrictionRequestList
        };
        await restrictionAccessor.updateLocationRestrictionAccessor(finalRestrictionObj);
    }
    const date = new Date();
    req.updatedDate = new Date();
    req.updatedBy = request.userId;
    const fullDate = `${date.getDate()}${(date.getMonth() + 1)}${date.getFullYear()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    beneficiaryResponse = await beneficiaryAccessor.getBeneficiaryDocumentByBeneficiaryIdAccessor([request.beneficiaryId]);
    countryCode = await getCountryCodeByLocationIdAccessor([request.country]);
    countryCode = objectHasPropertyCheck(countryCode, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(countryCode.rows) && notNullCheck(countryCode.rows[0]['location_code']) ? countryCode.rows[0]['location_code'] : 'OO';
    countryCode = countryCode.indexOf('-') !== -1 ? countryCode.split('-')[1] : countryCode;
    if (objectHasPropertyCheck(beneficiaryResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(beneficiaryResponse.rows)) {
        createFolderFlag = notNullCheck(beneficiaryResponse.rows[0]['dropbox_base_path']);
        profileName = `BENEFICIARY_${request['beneficiaryid']}_${fullDate}`;
        folderBasePath = notNullCheck(beneficiaryResponse.rows[0]['dropbox_base_path']) ? beneficiaryResponse.rows[0]['dropbox_base_path'] : `/pat-j/${countryCode}/${profileName}`;
    }
    const fileLocations = await imageStorageBusiness(imageUpload, folderBasePath, profileName, createFolderFlag);
    if (notNullCheck(fileLocations) && notNullCheck(fileLocations.sharePath)) {
        request.image = fileLocations.sharePath
    }
    response = await beneficiaryAccessor.updateBeneficiaryAccessor(request);
    await beneficiaryAccessor.updateFamilyAccessor(request);
    if (notNullCheck(response) && response['rowCount'] != 0) {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_BENEFICIARY_EDIT_SUCCESS, 'EN_US', 'Updated beneficiary data successfully');
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_BENEFICIARIES_FOR_ID, 'EN_US', '');
    }
    return finalResponse;
};

const deleteBeneficiaryBusiness = async (req) => {
    let request = {beneficiaryId: req.query.beneficiaryId, isActive: false}, response, finalResponse;
    request['endDate'] = new Date();
    request['deactivatedBy'] = req.query.userId;
    response = await beneficiaryAccessor.updateBeneficiaryAccessor(request);
    if (notNullCheck(response) && response['rowCount'] != 0) {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_BENEFICIARY_DEACTIVATE_SUCCESS, 'EN_US', 'Deleted beneficiary data successfully');
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_BENEFICIARIES_FOR_ID, 'EN_US', '');
    }
    return finalResponse;
};

const uploadBeneficiaryDocumentsBusiness = async (req) => {
    let documentName, finalResponse, beneficiaryResponse, uploadResponse, createResponse, countryCode,
        dropboxShareResponse;
    const date = new Date(),
        fullDate = `${date.getDate()}${(date.getMonth() + 1)}${date.getFullYear()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
    const request = req.body, postgresReq = [req.body.beneficiaryId];
    beneficiaryResponse = await beneficiaryAccessor.getBeneficiaryDocumentByBeneficiaryIdAccessor(postgresReq);
    const documentReq = [request.documentType];
    const documentNameResponse = await getDropdownNameFromKeyBusiness(documentReq);
    if (objectHasPropertyCheck(documentNameResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(documentNameResponse.rows)) {
        documentName = notNullCheck(documentNameResponse[COMMON_CONSTANTS.FENNIX_ROWS][0]['dropdown_value']) ? documentNameResponse[COMMON_CONSTANTS.FENNIX_ROWS][0]['dropdown_value'] : 'Document';
    }
    if (objectHasPropertyCheck(beneficiaryResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(beneficiaryResponse.rows)) {
        countryCode = notNullCheck(beneficiaryResponse[COMMON_CONSTANTS.FENNIX_ROWS][0]['location_code']) ? beneficiaryResponse[COMMON_CONSTANTS.FENNIX_ROWS][0]['location_code'] : 'OO';
        countryCode = countryCode.indexOf('-') !== -1 ? countryCode.split('-')[1] : countryCode;
        if (objectHasPropertyCheck(beneficiaryResponse[COMMON_CONSTANTS.FENNIX_ROWS][0], 'dropbox_base_path')) {
            uploadResponse = await uploadToDropboxBusiness(`${beneficiaryResponse[COMMON_CONSTANTS.FENNIX_ROWS][0]['dropbox_base_path']}/${documentName}`, request.document.fileData, request.documentName);
        } else {
            let folderName = `BENEFICIARY_${req.body.beneficiaryId}_${fullDate}`,
                folderBasePath = `/pat-j/${countryCode}/${folderName}`;
            createResponse = await createDropboxFolderBusiness(folderBasePath, documentName);
            if (createResponse) {
                uploadResponse = await uploadToDropboxBusiness(createResponse.folderLocation, request.document.fileData, request.documentName);
            }
        }
    }
    if (objectHasPropertyCheck(uploadResponse, 'uploadSuccessFlag') && uploadResponse['uploadSuccessFlag']) {
        const shareResponse = await shareDropboxLinkBusiness(uploadResponse.docUploadResponse.path_lower, false);
        const downloadPath = shareResponse.replace('?dl=0', '?dl=1');
        const fileFormat = request.document.fileType.split('/')[1];
        const documentObj = {
            documentId: `beneficiary_${req.body.beneficiaryId}_${documentName}_${fullDate}`,
            documentType: fileFormat,
            documentSize: request.document.fileSize,
            documentLink: downloadPath,
            documentName: request.documentName,
            documentOriginalName: request.document.fileName,
            createdDate: new Date(),
            createdByUser: request.document.createdBy
        };
        dropboxShareResponse = await updateBeneficiaryDocumentPathBusiness(req.body.beneficiaryId, documentName.toLowerCase(), documentObj);
        finalResponse = fennixResponse(statusCodeConstants.STATUS_BENEFICIARY_DOC_UPLOAD_SUCCESS, 'EN_US', []);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return finalResponse;
};
const getBenficiaryDocumentDownloadListBusiness = async (req) => {
    let returnObj, beneficiaryId = parseInt(req.query.beneficiaryId);
    returnObj = await beneficiaryAccessor.getBeneficiaryDocumentDownloadListAccessor(beneficiaryId);
    returnObj = arrayNotEmptyCheck(returnObj) ? returnObj[0] : [];
    return fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', returnObj);
};

const updateBeneficiaryDocumentPathBusiness = async (beneficiaryId, categoryName, documentObj) => {
    let returnObj;
    returnObj = await beneficiaryAccessor.updateBeneficiaryDocumentPathAccessor(parseInt(beneficiaryId), categoryName, documentObj);
    return returnObj;
};

const beneficiaryListForUnAssignedDevicesBusiness = async (req) => {
    let response, modifiedResponse = [], finalResponse;
    response = await beneficiaryAccessor.beneficiaryListOfUnAssignedDevicesAccesor([req.query.languageId]);
    if (objectHasPropertyCheck(response, 'rows') && arrayNotEmptyCheck(response.rows)) {
        response.rows.forEach((item) => {
            let obj = {
                id: item['beneficiaryid'],
                beneficiaryId: item['beneficiaryid'],
                beneficiaryName: item['full_name'],
                beneficiaryRole: item['role_name'],

            };
            modifiedResponse.push(obj);
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', modifiedResponse);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_BENEFICIARIES_FOR_ID, 'EN_US', []);
    }
    return finalResponse;
};
const beneficiaryMapDataList = async (req) => {
    let request = [req.body.userId, req.body.centerId, req.body.sort, parseInt(req.body.skip), req.body.limit, req.body.languageId],
        beneficiaryReturnObj = {}, gridData = {}, locationObj = {},
        beneficiaryDevices = {}, beneficiaryListResponse, returnObj,
        newReq = {
            query: {
                userId: req.body.userId,
                centerId: req.body.centerId,
                sort: req.body.sort,
                skip: parseInt(req.body.skip),
                limit: parseInt(req.body.limit),
                languageId: req.body.languageId
            }
        };
    beneficiaryListResponse = await beneficiaryAccessor.getBeneifciaryIdList(newReq);
    if (objectHasPropertyCheck(beneficiaryListResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(beneficiaryListResponse.rows)) {
        let beneficiaryIdListAndDetailObj, beneficiaryDeviceArray;
        beneficiaryIdListAndDetailObj = beneficiaryListResponse.rows.reduce((init, item) => {
            init.beneficiaryIdArray.push(parseInt(item.beneficiaryid));
            init.beneficiaryDetailObj[item.beneficiaryid] = {
                beneficiaryId: item['beneficiaryid'],
                firstName: item['firstname'],
                documentId: item['document_id'],
                mobileNo: item['mobileno'],
                image: item['image'],
                emailId: item['emailid'],
                // roleName: item['role'],
                beneficiaryRoleId: item['role_id'],
                gender: item['gender']
            };
            return init;
        }, {beneficiaryIdArray: [], beneficiaryDetailObj: {}});
        beneficiaryDeviceArray = await deviceBybeneficiaryQuery(beneficiaryIdListAndDetailObj.beneficiaryIdArray);
        beneficiaryDeviceArray.forEach((item) => {
            locationObj[item.beneficiaryId] = {...beneficiaryIdListAndDetailObj['beneficiaryDetailObj'][item.beneficiaryId]};
            locationObj[item.beneficiaryId]['location'] = {
                longitude: item.location.longitude,
                latitude: item.location.latitude
            };
            beneficiaryIdListAndDetailObj['beneficiaryDetailObj'][item.beneficiaryId]['imei'] = item['device']['imei'];
            locationObj[item.beneficiaryId]['roleId'] = beneficiaryIdListAndDetailObj['beneficiaryDetailObj'][item.beneficiaryId]['roleId'];
            const deviceDetails = {};
            let noOfViolations = 0;
            deviceDetails[item.beneficiaryId] = [];
            const GPS = {A: 'Valid', V: 'Invalid'};
            const batteryPercentage = deviceStatusMapper('batteryPercentage', item.deviceAttributes.batteryPercentage);
            if (batteryPercentage['deviceStatus'] === 'violation') {
                noOfViolations += 1;
            }
            if (item.deviceAttributes.beltStatus) {
                noOfViolations += 1;
            }
            if (item.deviceAttributes.shellStatus) {
                noOfViolations += 1;
            }
            deviceDetails[item.beneficiaryId].push({
                text: 'Battery',
                status: batteryPercentage['deviceStatus'],
                key: 'batteryPercentage',
                icon: 'battery_charging_full',
                value: `${item.deviceAttributes.batteryPercentage}%`
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'Belt',
                key: 'beltStatus',
                icon: 'link',
                status: item.deviceAttributes.beltStatus === 1 ? 'violation' : 'safe',
                value: item.deviceAttributes.beltStatus === 1 ? 'belt' : 'OK'
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'Shell',
                key: 'shellStatus',
                icon: 'lock',
                status: item.deviceAttributes.shellStatus === 1 ? 'violation' : 'safe',
                value: item.deviceAttributes.shellStatus === 1 ? 'shell' : 'OK'
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'GSM',
                key: 'gmsStatus',
                icon: 'signal_cellular_4_bar',
                status: item.deviceAttributes.gsmSignal < 2 ? 'violation' : 'safe',
                value: item.deviceAttributes.gsmSignal < 2 ? 'Low' : 'OK'
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'RF Home',
                key: 'rfConnectionStatus',
                icon: 'home',
                status: item.deviceAttributes.rfConnectionStatus === 0 ? 'violation' : 'safe',
                value: item.deviceAttributes.rfConnectionStatus === 0 ? 'Outdoor' : 'Home'
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'RFID',
                key: 'rfPlugStatus',
                icon: 'rss_feed',
                status: item.deviceAttributes.rfPlugStatus === 0 ? 'violation' : 'safe',
                value: item.deviceAttributes.rfPlugStatus === 0 ? 'Out' : 'In'
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'SAT',
                key: 'gpsStatus',
                icon: 'gps_fixed',
                status: item.deviceAttributes.gpsStatus === 'V' ? 'violation' : 'safe',
                value: GPS[item.deviceAttributes.gpsStatus]
            });
            deviceDetails[item.beneficiaryId].push({
                text: 'Speed',
                key: 'speed',
                icon: 'directions_run',
                status: item.deviceAttributes.speed > 0 ? 'moving' : 'still',
                value: Math.floor(item.deviceAttributes.speed)
            });
            beneficiaryDevices = {...deviceDetails};
            const completeDate = new Date(`${item.deviceAttributes.deviceUpdatedDate}`);
            const modifiedDate = `${completeDate.toLocaleDateString('es')} ${completeDate.toLocaleTimeString()}`;
            beneficiaryIdListAndDetailObj.beneficiaryDetailObj[item.beneficiaryId]['deviceUpdatedDate'] = modifiedDate;
            beneficiaryIdListAndDetailObj.beneficiaryDetailObj[item.beneficiaryId]['deviceDetails'] = deviceDetails[item.beneficiaryId];
            beneficiaryIdListAndDetailObj.beneficiaryDetailObj[item.beneficiaryId]['noOfViolations'] = {
                text: 'Number of Violations',
                value: noOfViolations
            };
            locationObj[item.beneficiaryId]['noOfViolations'] = noOfViolations;
            gridData[item.beneficiaryId] = {...beneficiaryIdListAndDetailObj.beneficiaryDetailObj[item.beneficiaryId]};
        });
        beneficiaryReturnObj['markers'] = Object.keys(locationObj).map(key => locationObj[key]);
        beneficiaryReturnObj['deviceDetails'] = beneficiaryDevices;
        beneficiaryReturnObj['deviceDetailsArray'] = Object.keys(beneficiaryDevices).map((device) => beneficiaryDevices[device]);
        beneficiaryReturnObj['gridData'] = Object.keys(gridData).map(data => gridData[data]);
        beneficiaryReturnObj['markerDetails'] = gridData;
        returnObj = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', beneficiaryReturnObj);
    } else {
        returnObj = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return returnObj;
};

const getBeneficiaryDetailsBusiness = async (req) => {
    let request = [req.query.beneficiaryId, req.query.languageId], response, finalResponse;
    response = await beneficiaryAccessor.getBeneficiaryByBeneficiaryIdAccesor(request);
    if (objectHasPropertyCheck(response, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(response.rows)) {
        const finalObj = {
            beneficiaryRoleId: response.rows[0]['beneficiary_role'],
            image: response.rows[0]['image'],
            beneficiaryRole: response.rows[0]['role_name'],
            gender: response.rows[0]['gender'],
            emailId: response.rows[0]['emailid'],
            beneficiaryName: `${response.rows[0]['full_name']}`,
            mobileNo: response.rows[0]['mobileno'],
            beneficiaryAddress: response.rows[0]['address1'],
            documentId: response.rows[0]['document_id'],
            beneficiaryDOB: response.rows[0]['dob']
        };
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', finalObj);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return finalResponse;
};

const beneficiaryListByOwnerUserId = async (req) => {
    let sortedArray = [], request = {
            userId: req.query.userId,
            centerId: req.query.centerId,
            skip: req.query.skip,
            limit: req.query.limit
        }, beneficiaryListResponse, finalReturnObj = {}, returnObj, totalNoOfRecords, beneficiaryIds = [],
        finalResponse = {}, userResponse;
    userResponse = await getUserIdsForAllRolesAccessor(req, COMMON_CONSTANTS.FENNIX_USER_DATA_MODIFIER_USER_USERID_NATIVE_ROLE);
    request.userIdList = userResponse.userIdsList;
    request.nativeUserRole = userResponse.nativeUserRole;
    beneficiaryListResponse = await beneficiaryAccessor.getBeneficiaryListByOwnerId(request);
    totalNoOfRecords = await beneficiaryAccessor.getTotalRecordsBasedOnOwnerUserIdAndCenterAccessor(request);
    finalResponse['totalNoOfRecords'] = objectHasPropertyCheck(totalNoOfRecords, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(totalNoOfRecords.rows) ? totalNoOfRecords.rows[0]['count'] : 0;
    if (objectHasPropertyCheck(beneficiaryListResponse, COMMON_CONSTANTS.FENNIX_ROWS) && arrayNotEmptyCheck(beneficiaryListResponse.rows)) {
        beneficiaryListResponse.rows.forEach(item => {
            finalReturnObj[item['beneficiaryid']] = {
                documentId: objectHasPropertyCheck(item, 'document_id') && notNullCheck(item['document_id']) ? item['document_id'] : 'Document Id Not Present',
                beneficiaryId: item['beneficiaryid'],
                beneficiaryRole: item['role_name'],
                beneficiaryRoleId: item['beneficiary_role'],
                beneficiaryGender: item['gender'],
                beneficiaryName: item['full_name'],
                emailId: item['emailid'],
                mobileNo: item['mobileno'],
                image: item['image'],
                center: objectHasPropertyCheck(item, 'center_name') && notNullCheck(item['center_name']) ? item['center_name'] : 'Center Not Assigned',
                crimeDetails: item['crime_id'],
            };
            beneficiaryIds.push(item['beneficiaryid']);
        });
        let deviceDetailsResponse = await getDeviceDetailsForListOfBeneficiariesAccessor(beneficiaryIds);
        if (arrayNotEmptyCheck(deviceDetailsResponse)) {
            deviceDetailsResponse.forEach(device => {
                finalReturnObj[device['beneficiaryId']] = {
                    ...finalReturnObj[device['beneficiaryId']],
                    deviceId: device['_id'],
                    imei: objectHasPropertyCheck(device, 'imei') && notNullCheck(device['imei']) ? device['imei'] : '999999999',
                    deviceType: objectHasPropertyCheck(device, 'deviceType') && arrayNotEmptyCheck(device['deviceType']) ? device['deviceType'][0]['name'] : 'No Device Type'
                };
            });
        }
        beneficiaryIds.forEach((id) => {
            sortedArray.push(finalReturnObj[id]);
        });
        finalResponse['gridData'] = sortedArray;
        returnObj = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', finalResponse);
    } else {
        returnObj = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return returnObj;
};


const listBeneficiariesForAddTicketBusiness = async (req) => {
    let userIdList, beneficiaryListResponse, finalResponse, responseList = {dropdownList: []}, request = {};
    userIdList = await getUserIdsForAllRolesAccessor(req, COMMON_CONSTANTS.FENNIX_USER_DATA_MODIFIER_USER_USERID);
    request.userIdList = userIdList;
    beneficiaryListResponse = await beneficiaryAccessor.getBeneficiaryListForAddTicketAccessor(request);
    if (objectHasPropertyCheck(beneficiaryListResponse, 'rows') && arrayNotEmptyCheck(beneficiaryListResponse.rows)) {
        beneficiaryListResponse.rows.forEach(item => {
            responseList.dropdownList.push(dropdownCreator(item['beneficiaryid'], item['full_name'], false));
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', responseList);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return finalResponse;
};


const downloadBeneficiariesBusiness = async (req) => {
    let request = {}, colsKeysResponse, rowsIdsResponse, workbook = new Excel.Workbook(), userIdList,
        beneficiaryListResponse, modifiedResponse, beneficiaryIds, keysArray,
        returnObj = {}, sheet = workbook.addWorksheet('Beneficiary Sheet');
    colsKeysResponse = await excelColCreator();
    sheet.columns = colsKeysResponse['cols'];
    keysArray = colsKeysResponse['keysArray'];
    userIdList = await getUserIdsForAllRolesAccessor(req, COMMON_CONSTANTS.FENNIX_USER_DATA_MODIFIER_USER_USERID);
    request.userIdList = userIdList;
    beneficiaryListResponse = await beneficiaryAccessor.getBeneficiaryListByOwnerIdForDownloadAccessor(request);
    rowsIdsResponse = excelRowsCreator(beneficiaryListResponse, 'beneficiaries', keysArray);
    beneficiaryIds = rowsIdsResponse['ids'];
    returnObj = rowsIdsResponse[COMMON_CONSTANTS.FENNIX_ROWS];
    if (arrayNotEmptyCheck(beneficiaryIds)) {
        let deviceDetailsResponse = await getDeviceDetailsForListOfBeneficiariesAccessor(beneficiaryIds);
        if (arrayNotEmptyCheck(deviceDetailsResponse)) {
            deviceDetailsResponse.forEach(device => {
                returnObj[device['beneficiaryId']] = {
                    ...returnObj[device['beneficiaryId']],
                    deviceId: device['_id'],
                    imei: objectHasPropertyCheck(device, 'imei') && notNullCheck(device['imei']) ? device['imei'] : '999999999',
                    deviceType: device['deviceType'][0]['name']
                }
            });
        }
    }
    modifiedResponse = Object.keys(returnObj).map(key => returnObj[key]);
    sheet.addRows(modifiedResponse);
    return workbook.xlsx.writeFile('/home/sindhura.gudarada/Downloads/test.xlsx');
};

const getAllBeneficiaryDetailsBusiness = async (req) => {
    let request = [req.query.beneficiaryId], response, modifiedResponse, benResponse, finalResponse,
        locationRestrictionResponse, restrictionResponse;
    response = await beneficiaryAccessor.getAllBeneficiaryDetailsAccessor(request);
    locationRestrictionResponse = await restrictionAccessor.fetchLocationRestrictionAccessor(req.query.beneficiaryId);
    if (arrayNotEmptyCheck(locationRestrictionResponse)) {
        let locations = [];
        locationRestrictionResponse[0]['locationDetails'].forEach((item) => {
            let obj = {
                lat: item['lat'],
                lng: item['lng']
            };
            locations.push(obj);
        });
        restrictionResponse = {
            repeatRules: locationRestrictionResponse[0]['repeatRules'],
            restrictionName: locationRestrictionResponse[0]['restrictionName'],
            restrictionType: locationRestrictionResponse[0]['restrictionType'],
            locationDetails: locations
        }
    }
    if (objectHasPropertyCheck(response, 'rows') && arrayNotEmptyCheck(response.rows)) {
        benResponse = response.rows[0];
        modifiedResponse = {
            beneficiaryId: benResponse['beneficiaryid'],
            firstName: benResponse['firstname'],
            middleName: benResponse['middle_name'],
            lastName: benResponse['first_last_name'],
            secondName: benResponse['second_last_name'],
            role: benResponse['beneficiary_role'],
            gender: benResponse['gender'],
            image: benResponse['image'],
            emailId: benResponse['emailid'],
            mobileNo: benResponse['mobileno'],
            dob: benResponse['dob'],
            address: benResponse['address1'],
            crimeId: benResponse['crime_id'],
            hasHouseArrest: benResponse['hashousearrest'],
            weight: benResponse['weight'],
            height: benResponse['height'],
            eyeColor: benResponse['eye_color'],
            hairColor: benResponse['hair_color'],
            scar: benResponse['scars_marks_tatoos'],
            riskId: benResponse['risk_id'],
            ethnicityId: benResponse['ethnicity_id'],
            zipCode: benResponse['postal_code'],
            center: benResponse['center_id'],
            operatorId: benResponse['owner_user_id'],
            isActive: benResponse['isactive'],
            comments: benResponse['comments'],
            timeZone: benResponse['time_zone'],
            languageId: benResponse['language_id'],
            whatsAppNo: benResponse['whatsapp_number'],
            sentenceLawyerId: benResponse['lawyer_id'],
            sentenceTutorId: benResponse['tutor_id'],
            sentenceDistrictAttorney: benResponse['district_attorney'],
            sentenceJudge: benResponse['judge'],
            sentenceCourtHouse: benResponse['court_house'],
            sentenceCountry: benResponse['sentence_country'],
            sentenceCity: benResponse['sentence_city'],
            familyPrimaryName: benResponse['primary_name'],
            familyPrimaryPhoneNo: benResponse['primary_phone_no'],
            familyPrimaryGender: benResponse['primary_gender'],
            familyPrimaryRelation: benResponse['primary_relation'],
            familySecondaryName: benResponse['secondary_name'],
            familySecondaryPhoneNo: benResponse['secondary_phone_no'],
            familySecondaryGender: benResponse['secondary_gender'],
            familySecondaryRelation: benResponse['secondary_relation'],
            familyInfoId: benResponse['family_info_id'],
            geoFence: restrictionResponse,
            country: benResponse['location_3']
            // scentenceLawyerId:sentence_house_arrest: null,
            // scentenceLawyerId:sentence_restraining_order: null,
        };
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', modifiedResponse);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_BENEFICIARY_FOR_ID, 'EN_US', []);
    }
    return finalResponse;
};

const addDeviceForBeneficiaryBusiness = async (req) => {
    let request, finalResponse;
    req.body.startDate = new Date();
    req.body.deviceAssignedBy = req.body.userId;
    await beneficiaryAccessor.updateBeneficiaryAccessor(req.body);
    request = {
        beneficiaryId: parseInt(req.body.beneficiaryId, 10),
        deviceId: parseInt(req.body.deviceId, 10)
    };
    await updateDeviceWithBeneficiaryIdAccessor(request);
    finalResponse = fennixResponse(statusCodeConstants.STATUS_DEVICE_ADD_SUCCESS, 'EN_US', 'Updated beneficiary data successfully');
    return finalResponse;
};

const getBeneficiaryMapHistoryBusiness = async (req) => {
    let request = {toDate: new Date(req.query.toDate).toISOString(), fromDate: new Date(req.query.fromDate).toISOString(), beneficiaryId: parseInt(req.query.beneficiaryId)}, response, finalResponse = {}, modifiedResponse = [];
    response = await deviceAccessor.getBeneficiaryIdByImeiAccessor(request);
    if (arrayNotEmptyCheck(response)) {
        response.forEach((item) => {
            let obj = {
                beneficiaryId: item['beneficiaryId'],
                latitude: item['latitude'],
                longitude: item['longitude'],
                deviceDate: item['deviceDate'],
                locationId: item['_id']
            };
            modifiedResponse.push(obj);
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', modifiedResponse);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_LOCATION_EXISTS_FOR_GIVEN_ID, 'EN_US', []);
    }
    return finalResponse;
};

module.exports = {
    addDeviceForBeneficiaryBusiness,
    beneficiaryAggregatorBusiness,
    beneficiaryListByOwnerUserId,
    beneficiaryMapDataList,
    getBeneficiaryDetailsBusiness,
    addBeneficiaryBusiness,
    listBeneficiariesForAddTicketBusiness,
    downloadBeneficiariesBusiness,
    updateBeneficiaryBusiness,
    deleteBeneficiaryBusiness,
    beneficiaryListForUnAssignedDevicesBusiness,
    getAllBeneficiaryDetailsBusiness,
    getBenficiaryDocumentDownloadListBusiness,
    uploadBeneficiaryDocumentsBusiness,
    getTimeZoneDetailsBusiness
};
