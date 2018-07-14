const {deviceAggregator, getDeviceByDeviceIdAccessor, listDevicesAccessor, listDeviceTypesAccessor, fetchNextPrimaryKeyAccessor, insertDeviceAccessor, insertNextPrimaryKeyAccessor} = require('../../repository-module/data-accesors/device-accesor');
const {notNullCheck, objectHasPropertyCheck, arrayNotEmptyCheck} = require('../../util-module/data-validators');
const {getBeneficiaryByUserIdAccessor, getBeneficiaryNameFromBeneficiaryIdAccessor} = require('../../repository-module/data-accesors/beneficiary-accesor');
const userAccessor = require('../../repository-module/data-accesors/user-accesor');
const {fennixResponse} = require('../../util-module/custom-request-reponse-modifiers/response-creator');
const centerMetadataAccessors = require('../../repository-module/data-accesors/metadata-accesor');
const {statusCodeConstants} = require('../../util-module/status-code-constants');
const {getCenterIdsForLoggedInUserAndSubUsersAccessor} = require('../../repository-module/data-accesors/location-accesor');

const deviceAggregatorDashboard = async (req) => {
    const request = [req.query.languageId, req.query.userId];
    let beneficiaryResponse, deviceResponse, returnObj, userDetailResponse, otherUserIdsForGivenUserId, userIdList = [];
    userDetailResponse = await userAccessor.getUserNameFromUserIdAccessor(request);
    if (objectHasPropertyCheck(userDetailResponse, 'rows') && arrayNotEmptyCheck(userDetailResponse.rows)) {
        let nativeUserRole = userDetailResponse.rows[0]['native_user_role'];
        switch (nativeUserRole) {
            case 'ROLE_SUPERVISOR' : {
                otherUserIdsForGivenUserId = await userAccessor.getUserIdsForSupervisorAccessor([req.query.userId, req.query.languageId]);
                break;
            }
            case 'ROLE_ADMIN' : {
                otherUserIdsForGivenUserId = await userAccessor.getUserIdsForAdminAccessor([req.query.userId, req.query.languageId]);
                break;
            }
            case 'ROLE_SUPER_ADMIN' : {
                otherUserIdsForGivenUserId = await userAccessor.getUserIdsForSuperAdminAccessor([req.query.userId, req.query.languageId]);
                break;
            }
            case 'ROLE_MASTER_ADMIN' : {
                otherUserIdsForGivenUserId = await userAccessor.getUserIdsForMasterAdminAccessor([req.query.userId, req.query.languageId]);
                break;
            }
        }
        otherUserIdsForGivenUserId.rows.forEach(item => {
            userIdList.push(item['user_id']);
        });
    }
    beneficiaryResponse = await getBeneficiaryByUserIdAccessor(userIdList);
    if (objectHasPropertyCheck(beneficiaryResponse, 'rows') && arrayNotEmptyCheck(beneficiaryResponse.rows)) {
        let deviceArray = [];
        beneficiaryResponse.rows.forEach((item) => {
            deviceArray.push(`${item.beneficiaryid}`);
        });
        deviceResponse = await deviceAggregator(deviceArray);
    }
    if (notNullCheck(deviceResponse) && arrayNotEmptyCheck(deviceResponse)) {
        let deviceObj = {
            ACTIVE: {key: 'activeDevices', value: '', color: '', legend: 'ACTIVE'},
            INACTIVE: {key: 'inActiveDevices', value: '', color: '', legend: 'INACTIVE'}
        };
        if (deviceResponse.length === 1) {
            let propertyName = deviceResponse[0]['_id'] ? 'ACTIVE' : 'INACTIVE';
            let propertyName2 = propertyName === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            deviceObj[propertyName]['value'] = deviceResponse[0]['count'];
            deviceObj[propertyName2]['value'] = 0;
        } else {
            deviceResponse.forEach((item) => {
                let prop = item['_id'] ? 'ACTIVE' : 'INACTIVE';
                deviceObj[prop]['value'] = item['count'];
            });
        }
        returnObj = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', deviceObj);
    } else {
        returnObj = fennixResponse(statusCodeConstants.STATUS_USER_RETIRED, 'EN_US', []);
    }
    return returnObj;
};

const listDeviceTypesBusiness = async () => {
    let deviceTypesResponse, finalResponse;
    deviceTypesResponse = await listDeviceTypesAccessor();
    finalResponse = arrayNotEmptyCheck(deviceTypesResponse) ? fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', deviceTypesResponse) : fennixResponse(statusCodeConstants.STATUS_NO_DEVICE_TYPES_FOR_ID, 'EN_US', []);
    return finalResponse;
};

const listDevicesBusiness = async (req) => {
    let userIdList, centerIdResponse, centerIdsReq = [], centerIdNameMap = {},
        beneficiaryIdNameMap = {}, devicesResponse, beneficiaryNameResponse, beneficiaryIds = [],
        modifiedResponse = {gridData: []}, finalResponse;
    userIdList = await userAccessor.getUserIdsForAllRolesAccessor(req);
    centerIdResponse = await getCenterIdsForLoggedInUserAndSubUsersAccessor(userIdList);
    if (objectHasPropertyCheck(centerIdResponse, 'rows') && arrayNotEmptyCheck(centerIdResponse.rows)) {
        centerIdResponse.rows.forEach(item => {
            centerIdsReq.push(item['center_id']);
            centerIdNameMap[item['center_id']] = item['center_name'];
        });
        devicesResponse = await listDevicesAccessor(centerIdsReq);
    }

    if (arrayNotEmptyCheck(devicesResponse)) {
        devicesResponse.forEach((item) => {
            beneficiaryIds.push(`${item['beneficiaryId']}`);
        });
        beneficiaryNameResponse = await getBeneficiaryNameFromBeneficiaryIdAccessor(beneficiaryIds, req.query.languageId);
        if (objectHasPropertyCheck(beneficiaryNameResponse, 'rows') && arrayNotEmptyCheck(beneficiaryNameResponse.rows)) {
            beneficiaryNameResponse.rows.forEach((item) => {
                let beneficiaryObj = {
                    fullName: item['full_name'],
                    roleName: item['role_name'],
                    roleId: item['beneficiary_role']
                };
                beneficiaryIdNameMap[item['beneficiaryid']] = beneficiaryObj;
            });
        }
        devicesResponse.forEach((item) => {
            deviceObj = {
                deviceId: item['_id'],
                deviceType: item['deviceTypes']['name'],
                imei: item['imei'],
                isActive: item['isActive'],
                mobileNo: item['simcards']['phoneNo'],
                center: centerIdNameMap[item['centerId']],
                beneficiaryName: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'fullName') ? beneficiaryIdNameMap[item['beneficiaryId']]['fullName'] : '-',
                beneficiaryRole: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'roleName') ? beneficiaryIdNameMap[item['beneficiaryId']]['roleName'] : '-',
                beneficiaryRoleId: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'roleId') ? beneficiaryIdNameMap[item['beneficiaryId']]['roleId'] : '-'
            };
            modifiedResponse.gridData.push(deviceObj);
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', modifiedResponse);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_DEVICES_FOR_ID, 'EN_US', []);
    }
    return finalResponse;
};

//
// const listDevicesBusiness = async (req) => {
//     let centerIdResponse, centerIdsReq = [], centerIdNameMap = {},
//         beneficiaryIdNameMap = {}, devicesResponse, beneficiaryNameResponse, beneficiaryIds = [],
//         modifiedResponse = {gridData: []}, finalResponse;
//     centerIdResponse = await centerMetadataAccessors.getCenterIdsAccessor(req);
//     if (objectHasPropertyCheck(centerIdResponse, 'rows') && arrayNotEmptyCheck(centerIdResponse.rows)) {
//         centerIdResponse.rows.forEach(item => {
//             centerIdsReq.push(item['location_id']);
//             centerIdNameMap[item['location_id']] = item['location_name'];
//         });
//         devicesResponse = await listDevicesAccessor(centerIdsReq);
//     }
//
//     if (arrayNotEmptyCheck(devicesResponse)) {
//         devicesResponse.forEach((item) => {
//             beneficiaryIds.push(item['beneficiaryId']);
//         });
//         beneficiaryNameResponse = await getBeneficiaryNameFromBeneficiaryIdAccessor(beneficiaryIds, req.query.languageId);
//         if (objectHasPropertyCheck(beneficiaryNameResponse, 'rows') && arrayNotEmptyCheck(beneficiaryNameResponse.rows)) {
//             beneficiaryNameResponse.rows.forEach((item) => {
//                 let beneficiaryObj = {
//                     fullName: item['full_name'],
//                     roleName: item['role_name'],
//                     roleId: item['beneficiary_role']
//                 };
//                 beneficiaryIdNameMap[item['beneficiaryid']] = beneficiaryObj;
//             });
//         }
//         devicesResponse.forEach((item) => {
//             deviceObj = {
//                 deviceId: item['_id'],
//                 deviceType: item['deviceTypes']['name'],
//                 imei: item['imei'],
//                 isActive: item['isActive'],
//                 mobileNo: item['simcards']['phoneNo'],
//                 center: centerIdNameMap[item['centerId']],
//                 beneficiaryName: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'fullName') ? beneficiaryIdNameMap[item['beneficiaryId']]['fullName'] : '-',
//                 beneficiaryRole: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'roleName') ? beneficiaryIdNameMap[item['beneficiaryId']]['roleName'] : '-',
//                 beneficiaryRoleId: objectHasPropertyCheck(beneficiaryIdNameMap[item['beneficiaryId']], 'roleId') ? beneficiaryIdNameMap[item['beneficiaryId']]['roleId'] : '-'
//             };
//             modifiedResponse.gridData.push(deviceObj);
//         });
//         finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', modifiedResponse);
//     } else {
//         finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_DEVICES_FOR_ID, 'EN_US', []);
//     }
//     return finalResponse;
// };

const insertDeviceBusiness = async (req) => {
    let primaryKeyResponse, counter;
    primaryKeyResponse = await fetchNextPrimaryKeyAccessor();
    if (arrayNotEmptyCheck(primaryKeyResponse)) {
        counter = parseInt(primaryKeyResponse[0]['counter']);
        let obj = {
            _id: counter,
            imei: req.body.imei,
            centerId: req.body.centerId,
            simCardId: req.body.simCardId,
            deviceTypeId: req.body.deviceTypeId,
            active: req.body.isActive,
            createdDate: new Date()
        };
        insertDeviceAccessor(obj);
        insertNextPrimaryKeyAccessor(primaryKeyResponse[0]['_doc']['_id']);
    }
};

const getDeviceByDeviceIdBusiness = async (req) => {
    const request = {deviceId: req.query.deviceId};
    let deviceResponse, returnObj;
    deviceResponse = await getDeviceByDeviceIdAccessor(request);
    if (notNullCheck(deviceResponse)) {
        returnObj = fennixResponse(statusCodeConstants.STATUS_OK, 'EN_US', deviceResponse);
    } else {
        returnObj = fennixResponse(statusCodeConstants.STATUS_NO_DEVICES_FOR_ID, 'EN_US', []);
    }
    return returnObj;
};

module.exports = {
    deviceAggregatorDashboard,
    listDevicesBusiness,
    insertDeviceBusiness,
    getDeviceByDeviceIdBusiness,
    listDeviceTypesBusiness
};