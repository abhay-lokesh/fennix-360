const {getCardMetadataAccessor, getRolesForRoleIdAccessor, getCenterIdsForAdminAccessor, getCenterIdsAccessor, getDropdownAccessor, getCenterIdsForMasterAdminAccessor, getCenterIdsForOperatorAccessor, getCenterIdsForSuperAdminAccessor, getCenterIdsForSupervisorAccessor, getFilterMetadataAccessor, getModalMetadataAccessor, getHeaderMetadataAccessor, getLoginMetadataAccessor, getLanguagesAccessor, getSideNavMetadataAccessor, getCenterIdsBasedOnUserIdAccessor, getSimcardDetailsAccessor, getRolesAccessor} = require('../../repository-module/data-accesors/metadata-accesor');
const {objectHasPropertyCheck, arrayNotEmptyCheck} = require('../../util-module/data-validators');
const {fennixResponse, dropdownCreator} = require('../../util-module/custom-request-reponse-modifiers/response-creator');
const {statusCodeConstants} = require('../../util-module/status-code-constants');
const {mongoWhereInCreator} = require('../../util-module/request-validators');
const {getCountryListAccessor} = require('../../repository-module/data-accesors/location-accesor');
const metadataAccessor = require('../../repository-module/data-accesors/metadata-accesor');
const {getUserNameFromUserIdAccessor} = require('../../repository-module/data-accesors/user-accesor');

const getBaseMetadataBusiness = async (req) => {
    let responseObj, headerResponse, sideNavResponse, composedData = {}, request;
    request = [req.body.userId, req.body.lang];
    headerResponse = await getHeaderMetadataAccessor(request);
    sideNavResponse = await getSideNavMetadataAccessor(request);
    if (objectHasPropertyCheck(headerResponse, 'rows') && objectHasPropertyCheck(sideNavResponse, 'rows')) {
        let headerObj = routeDataModifier(headerResponse);
        let sideNavObj = routeDataModifier(sideNavResponse);
        composedData['header'] = Object.keys(headerObj).map(dataItem => headerObj[dataItem]);
        composedData['sideNav'] = Object.keys(sideNavObj).map(dataItem => sideNavObj[dataItem]).sort((item, prevItem) => (item.sideNavOrder - prevItem.sideNavOrder));
        responseObj = fennixResponse(statusCodeConstants.STATUS_OK, 'en', composedData);
    } else {
        responseObj = fennixResponse(statusCodeConstants.STATUS_NO_CARDS_FOR_USER_ID, 'en', composedData);
    }
    return responseObj;
};

const getCardMetadataForRouteBusiness = async (req) => {
    let responseObj, cardResponse, request;
    request = [req.body.userId, req.body.routeId, req.body.lang];
    cardResponse = await getCardMetadataAccessor(request);
    if (objectHasPropertyCheck(cardResponse, 'rows') && arrayNotEmptyCheck(cardResponse.rows)) {
        let returnObj;
        returnObj = cardResponse.rows.reduce(function (init, item) {
            if (objectHasPropertyCheck(init, 'widgetCards') && !objectHasPropertyCheck(init.widgetCards, item['role_cards_widgets_id'])) {
                const widgetObj = {};
                widgetObj[item['role_cards_widgets_id']] = {};
                init['widgetCards'][item['role_cards_widgets_id']] = {
                    cardId: 'C_' + item['role_card_id'],
                    cardSize: item['card_size'],
                    cardHeader: item['card_header'],
                    cardOrderId: item['card_order_id'],
                    widgets: widgetObj
                }
            }
            if (objectHasPropertyCheck(init['widgetCards'][item['role_cards_widgets_id']], 'widgets') && !objectHasPropertyCheck(init['widgetCards']['widgets'], item['role_cards_widgets_id'])) {
                let widgetSectionsObj = {...init['widgetCards'][item['role_cards_widgets_id']]['widgets'][item['role_cards_widgets_id']].widgetSections} || {};
                widgetSectionsObj = widgetSectionCreator(item, widgetSectionsObj);

                init['widgetCards'][item['role_cards_widgets_id']]['widgets'][item['role_cards_widgets_id']] = {
                    widgetId: 'W_' + item['role_cards_widgets_id'],
                    widgetOrderId: item['widget_order_id'],
                    widgetSize: item['widget_size'],
                    widgetSections: {...widgetSectionsObj},
                    widgetEndpoint: item['widget_endpoint'],
                    widgetInitSort: item['widget_init_sort'],
                    widgetReqType: item['widget_req_type'],
                    widgetReqParams: item['widget_req_params']
                }
            }
            return init;
        }, {widgetCards: {}});
        returnObj.widgetCards = Object.keys(returnObj.widgetCards).map((card) => {
            returnObj.widgetCards[card]['widgets'] = Object.keys(returnObj.widgetCards[card]['widgets']).map((widget) => {
                returnObj.widgetCards[card]['widgets'][widget]['widgetSections'] = Object.keys(returnObj.widgetCards[card]['widgets'][widget]['widgetSections']).map((section) => {
                    returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections'] = Object.keys(returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections']).map((subsection) => {
                        returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections'][subsection]['widgetSectionRows'] = Object.keys(returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections'][subsection]['widgetSectionRows']).map((row) => returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections'][subsection]['widgetSectionRows'][row]);
                        return returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section]['widgetSubSections'][subsection]
                    });
                    return returnObj.widgetCards[card]['widgets'][widget]['widgetSections'][section];
                });
                return returnObj.widgetCards[card]['widgets'][widget];
            });
            return returnObj.widgetCards[card];
        });
        responseObj = fennixResponse(statusCodeConstants.STATUS_OK, 'en', returnObj.widgetCards);
    } else {
        responseObj = fennixResponse(statusCodeConstants.STATUS_NO_CARDS_FOR_USER_ID, 'en', []);
    }
    return responseObj;
};

const getFilterMetadataBusiness = async (req, colName) => {
    let request = [req.query.id], filterResponse, response;
    filterResponse = await getFilterMetadataAccessor(request, colName);
    if (objectHasPropertyCheck(filterResponse, 'rows') && arrayNotEmptyCheck(filterResponse.rows)) {
        response = fennixResponse(statusCodeConstants.STATUS_OK, 'en', filterResponse);
    } else {
        response = fennixResponse(statusCodeConstants.STATUS_NO_FILTERS_FOR_ID, 'en', []);
    }
    return response;
};

const getSimCardDetailsBusiness = async (req) => {
    var request = [req.query.userId], centerIds, mongoRequest, response;
    centerIds = await getCenterIdsBasedOnUserIdAccessor(request);
    if (objectHasPropertyCheck(centerIds, 'rows') && arrayNotEmptyCheck(centerIds.rows)) {
        let centerIdsReq = [];
        centerIds.rows.forEach(item => {
            centerIdsReq.push(`${item['location_id']}`);
        });
        mongoRequest = {centerId: mongoWhereInCreator(centerIdsReq)};
        response = await getSimcardDetailsAccessor(mongoRequest);
    }
    return response;
};

const getLoginMetadataBusiness = async (req) => {
    let responseObj, loginMetadtaResponse = {widgetSections: {}};
    responseObj = await getLoginMetadataAccessor();
    if (objectHasPropertyCheck(responseObj, 'rows') && arrayNotEmptyCheck(responseObj.rows)) {
        loginMetadtaResponse.widgetSections = responseObj.rows.reduce((init, item) => {
            init = {...init, ...widgetSectionCreator(item, init)};
            return init;
        }, {});
        loginMetadtaResponse['widgetSections'] = Object.keys(loginMetadtaResponse.widgetSections).map((section) => {
            loginMetadtaResponse.widgetSections[section]['widgetSubSections'] = Object.keys(loginMetadtaResponse.widgetSections[section]['widgetSubSections']).map((subsection) => {
                loginMetadtaResponse.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows'] = Object.keys(loginMetadtaResponse.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows']).map((rows) => loginMetadtaResponse.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows'][rows]);
                return loginMetadtaResponse.widgetSections[section]['widgetSubSections'][subsection];
            });
            return loginMetadtaResponse.widgetSections[section];
        });
    }
    return fennixResponse(statusCodeConstants.STATUS_OK, 'en', loginMetadtaResponse);
};

const getLanguagesListBusiness = async (req) => {
    let responseObj, request, languageListResponse = {dropdownList: []};
    responseObj = await getLanguagesAccessor();
    if (objectHasPropertyCheck(responseObj, 'rows') && arrayNotEmptyCheck(responseObj.rows)) {
        responseObj.rows.forEach((item) => {
            languageListResponse.dropdownList.push(dropdownCreator(item.language_code, item.language_name, false));
        });
    }
    return fennixResponse(statusCodeConstants.STATUS_OK, 'en', languageListResponse);
};

const getModelMetadataBusiness = async (req) => {
    let response, responseMap = {modalHeader: '', modalBody: {widgetSections: {}}}, request;
    request = [req.query.modalId, req.query.languageId];
    response = await getModalMetadataAccessor(request);
    if (objectHasPropertyCheck(response, 'rows') && arrayNotEmptyCheck(response.rows)) {
        response.rows.forEach((item) => {
            responseMap.modalHeader = responseMap.modalHeader || item['modal_header'];
            responseMap.modalBody = {
                modalDataEndpoint: item['modal_data_endpoint'],
                modalDataReqType: item['modal_data_request_type'],
                modalDataReqParams: item['modal_data_request_params'],
                modalWidth: item['modal_width'],
                widgetSections: widgetSectionCreator(item, responseMap.modalBody.widgetSections)
            }
        });
        responseMap.modalBody.widgetSections = Object.keys(responseMap.modalBody.widgetSections).map((section) => {
            responseMap.modalBody.widgetSections[section]['widgetSubSections'] = Object.keys(responseMap.modalBody.widgetSections[section]['widgetSubSections']).map((subsection) => {
                responseMap.modalBody.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows'] = Object.keys(responseMap.modalBody.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows']).map((row) => responseMap.modalBody.widgetSections[section]['widgetSubSections'][subsection]['widgetSectionRows'][row]);
                return responseMap.modalBody.widgetSections[section]['widgetSubSections'][subsection];
            });
            return responseMap.modalBody.widgetSections[section];
        });
        response = fennixResponse(statusCodeConstants.STATUS_OK, 'en', responseMap);
    } else {
        response = fennixResponse(statusCodeConstants.STATUS_NO_ROLES, 'en', []);
    }
    return response;
};

const getLanguageListGridBusiness = async (req) => {
    let responseObj, request, languageListResponse = {gridData: []};
    responseObj = await getLanguagesAccessor();
    if (objectHasPropertyCheck(responseObj, 'rows') && arrayNotEmptyCheck(responseObj.rows)) {
        responseObj.rows.forEach((item) => {
            const languageObj = {
                languageId: item['language_id'],
                language: item['language_name'],
                languageIso: item['iso_code'],
                activeStatus: item['isactive']
            };
            languageListResponse['gridData'].push(languageObj);
        });
    }
    return fennixResponse(statusCodeConstants.STATUS_OK, 'en', languageListResponse);
};

const getRolesForRoleIdBusiness = async (req) => {
    let request = [req.query.userRoleId, req.query.languageId], response, finalResponse;
    response = await getRolesForRoleIdAccessor(request);
    if (objectHasPropertyCheck(response, 'rows') && arrayNotEmptyCheck(response.rows)) {
        if (req.query.isDropdownFlag) {
            const dropdownObj = {dropdownList: []};
            response.rows.forEach((role) => {
                dropdownObj.dropdownList.push(dropdownCreator(role['role_id'], role['role_name'], false));
            });
            finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', dropdownObj);
        } else {
            finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', response.rows);
        }
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_ROLES_FOR_ID, 'en', []);
    }
    return finalResponse;
};
const getRolesBusiness = async (req) => {
    let response, rolesResponse;
    rolesResponse = getRolesAccessor([req.query.languageId]);
    if (objectHasPropertyCheck(rolesResponse, 'rows') && arrayNotEmptyCheck(rolesResponse.rows)) {
        let rolesResponse = rolesResponse.rows[0];
        response = fennixResponse(statusCodeConstants.STATUS_OK, 'en', rolesResponse);
    } else {
        response = fennixResponse(statusCodeConstants.STATUS_NO_ROLES, 'en', []);
    }
    return response;
};

const listCentersBusiness = async (req) => {
    let request = [req.query.userId], userDetailResponse, centerIdResponse, finalResponse,
        centerIdList = {dropdownList: []};
    centerIdResponse = await getCenterIdsAccessor(req);
    // userDetailResponse = await getUserNameFromUserIdAccessor([req.query.languageId, req.query.userId]);
    // if (objectHasPropertyCheck(userDetailResponse, 'rows') && arrayNotEmptyCheck(userDetailResponse.rows)) {
    //     let nativeUserRole = userDetailResponse.rows[0]['native_user_role'];
    //     switch (nativeUserRole) {
    //         case 'ROLE_OPERATOR' : {
    //             centerIdResponse = await getCenterIdsForOperatorAccessor(request);
    //             break;
    //         }
    //         case 'ROLE_SUPERVISOR' : {
    //             centerIdResponse = await getCenterIdsForSupervisorAccessor(request);
    //             break;
    //         }
    //         case 'ROLE_ADMIN' : {
    //             centerIdResponse = await getCenterIdsForAdminAccessor(request);
    //             break;
    //         }
    //         case 'ROLE_SUPER_ADMIN' : {
    //             centerIdResponse = await getCenterIdsForSuperAdminAccessor(request);
    //             break;
    //         }
    //         case 'ROLE_MASTER_ADMIN' : {
    //             centerIdResponse = await getCenterIdsForMasterAdminAccessor(request);
    //             break;
    //         }
    //     }
    // }
    if (objectHasPropertyCheck(centerIdResponse, 'rows') && arrayNotEmptyCheck(centerIdResponse.rows)) {
        centerIdResponse.rows.forEach(item => {
            centerIdList.dropdownList.push(dropdownCreator(item['location_id'], item['location_name'], false));
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', centerIdList);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_CENTERS_FOR_ID, 'en', []);
    }
    return finalResponse;
};

const dropDownBusiness = async (req) => {
    let request = [req.query.dropdownId, req.query.languageId], dropdownResponse, returnResponse = [];
    dropdownResponse = await getDropdownAccessor(request);
    if (objectHasPropertyCheck(dropdownResponse, 'rows') && arrayNotEmptyCheck(dropdownResponse.rows)) {
        dropdownResponse.rows.forEach((item) => {
            returnResponse.push(dropdownCreator(item['dropdown_key'], item['dropdown_value'], false));
        });
        returnResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', returnResponse);
    } else {
        returnResponse = fennixResponse(statusCodeConstants.STATUS_NO_DROPDOWN, 'en', []);
    }
    return returnResponse;
};

const getCountryListBusiness = async (req) => {
    let request = {userId: req.query.userId, languageId: req.query.languageId}, userDetailsResponse,
        countryListResponse, finalResponse, countryIdList = {dropdownList: []};
    userDetailsResponse = await getUserNameFromUserIdAccessor([req.query.languageId, req.query.userId]);
    if (objectHasPropertyCheck(userDetailsResponse, 'rows') && arrayNotEmptyCheck(userDetailsResponse.rows)) {
        request.userRole = userDetailsResponse.rows[0]['native_user_role'];
        countryListResponse = await getCountryListAccessor(request);
    }
    if (objectHasPropertyCheck(countryListResponse, 'rows') && arrayNotEmptyCheck(countryListResponse.rows)) {
        countryListResponse.rows.forEach(item => {
            countryIdList.dropdownList.push(dropdownCreator(item['locale_key'], item['country_name'], false));
        });
        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', countryIdList);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_COUNTRIES_FOR_ID, 'en', []);
    }

    return finalResponse;
};

//Private methods to modify the data for the way we need in the response
const widgetSectionCreator = (widgetItem, widgetSectionObj) => {
    let widgetSectionFinalObj = {};
    if (!objectHasPropertyCheck(widgetSectionObj, widgetItem['widget_section_order_id'])) {
        let widgetSectionBaseObj = {[widgetItem['widget_section_order_id']]: {}};
        widgetSectionBaseObj[widgetItem['widget_section_order_id']] = {
            sectionId: widgetItem['widget_section_order_id'],
            sectionTitle: widgetItem['widget_section_title'],
            sectionType: widgetItem['widget_section_type'],
            sectionOrientation: objectHasPropertyCheck(widgetItem, 'section_orientation') ? widgetItem['section_orientation'] : 'V',
            sectionSubType: widgetItem['widget_section_subtype'],
            widgetSubSections: widgetSubSectionCreator(widgetItem, {})
        };
        widgetSectionFinalObj = {...widgetSectionObj, ...widgetSectionBaseObj};
    } else {
        widgetSectionObj[widgetItem['widget_section_order_id']]['widgetSubSections'] = widgetSubSectionCreator(widgetItem, widgetSectionObj[widgetItem['widget_section_order_id']]['widgetSubSections']);
        widgetSectionFinalObj = widgetSectionObj;
    }
    return widgetSectionFinalObj;
};

const widgetSubSectionCreator = (widgetSubSectionItem, subSectionObj) => {
    let widgetSubSectionFinalObj = {};
    if (!objectHasPropertyCheck(subSectionObj, widgetSubSectionItem['widget_sub_section_order_id'])) {
        let widgetSubSectionBaseObj = {[widgetSubSectionItem['widget_sub_section_order_id']]: {}};
        widgetSubSectionBaseObj[widgetSubSectionItem['widget_sub_section_order_id']] = {
            subSectionType: widgetSubSectionItem['widget_sub_section_type'],
            subSectionOrderId: widgetSubSectionItem['widget_sub_section_order_id'],
            subSectionTitle: widgetSubSectionItem['widget_sub_section_title'],
            subSectionWidth: widgetSubSectionItem['sub_section_width'],
            subSectionOrientation: objectHasPropertyCheck(widgetSubSectionItem, 'sub_section_orientation') ? widgetSubSectionItem['sub_section_orientation'] : 'V',
            widgetSectionRows: {...widgetSectionRowCreator(widgetSubSectionItem, {})}
        };
        widgetSubSectionFinalObj = {...subSectionObj, ...widgetSubSectionBaseObj};
    } else {
        subSectionObj[widgetSubSectionItem['widget_sub_section_order_id']]['widgetSectionRows'] = {...subSectionObj[widgetSubSectionItem['widget_sub_section_order_id']]['widgetSectionRows'], ...widgetSectionRowCreator(widgetSubSectionItem, subSectionObj[widgetSubSectionItem['widget_sub_section_order_id']]['widgetSectionRows'])};
        widgetSubSectionFinalObj = subSectionObj;
    }
    return widgetSubSectionFinalObj;
};

const widgetSectionRowCreator = (widgetRowItem, sectionRowObj) => {
    let widgetSectionRowFinalObj = {};
    if (!objectHasPropertyCheck(sectionRowObj, widgetRowItem['widget_row_count'])) {
        let widgetSectionRowBaseObj = {[widgetRowItem['widget_row_count']]: {}};
        widgetSectionRowBaseObj[widgetRowItem['widget_row_count']] = {
            sectionRowId: widgetRowItem['widget_row_count'],
            sectionCols: [widgetColElementCreator(widgetRowItem)]
        };
        widgetSectionRowFinalObj = {...sectionRowObj, ...widgetSectionRowBaseObj};
    } else {
        const originalCol = [...sectionRowObj[widgetRowItem['widget_row_count']]['sectionCols']];
        originalCol.push(widgetColElementCreator(widgetRowItem));
        sectionRowObj[widgetRowItem['widget_row_count']] = {
            sectionRowId: widgetRowItem['widget_row_count'],
            sectionCols: [...originalCol]
        };
        widgetSectionRowFinalObj = sectionRowObj;
    }
    return widgetSectionRowFinalObj;
};

const widgetColElementCreator = (widgetColItem) => {
    let widgetBaseColItem = {
        widgetColId: widgetColItem['widget_col_count'],
        widgetColType: widgetColItem['widget_element_type'],
        widgetColSubType: widgetColItem['widget_element_subtype']
    };
    switch (widgetColItem['widget_section_type'].toLowerCase()) {
        case 'grid':
            widgetBaseColItem = {...widgetBaseColItem, ...widgetGridElementCreator(widgetColItem)};
            break;
        case 'chart':
            widgetBaseColItem = {...widgetBaseColItem, ...widgetChartElementCreator(widgetColItem)};
            break;
        case 'form':
            widgetBaseColItem = {...widgetBaseColItem, ...widgetFormElementCreator(widgetColItem)};
            break;
        case 'details':
            widgetBaseColItem = {...widgetBaseColItem, ...widgetDetailElementCreator(widgetColItem)};
            break;
        case 'map':
            widgetBaseColItem = {...widgetBaseColItem, ...widgetMapElementCreator(widgetColItem)};
            break;
    }
    return widgetBaseColItem;
};

const widgetGridElementCreator = (widgetElementItem) => {
    let returnObj = {
        gridElementAction: widgetElementItem['element_action_type'],
        gridHeaderOrderId: widgetElementItem['widget_col_count'],
        gridHeaderMappingKey: widgetElementItem['request_mapping_key'],
        gridColType: widgetElementItem['element_type'],
        gridColSubType: widgetElementItem['element_subtype'],
        subWidgetColId: widgetElementItem['widget_col_count'],
        subWidgetRowId: widgetElementItem['widget_row_count'],
        gridHeaderColName: widgetElementItem['element_title'],
        gridHeaderWidth: widgetElementItem['attribute_width']
    };
    switch (widgetElementItem['element_subtype'].toLowerCase()) {
        case 'modal-pill':
        case 'device-list':
            returnObj = {
                ...returnObj,
                primaryValue: widgetElementItem['element_primary_value__validation'],
                secondaryValue: widgetElementItem['element_secondary_value__async_validation'],
                hoverValue: widgetElementItem['default_value__hover_value'],
                accentValue: widgetElementItem['default_key__accent_value'],
                iconValue: widgetElementItem['element_icon_value'],
                gridModalId: widgetElementItem['element_modal_id'],
                gridModalDataKey: widgetElementItem['request_mapping_key']
            };
            break;
        case 'action-bar':
            returnObj = {
                ...returnObj,
                buttonArray: [widgetElementItem['default_key__accent_value'], widgetElementItem['default_value__hover_value'], widgetElementItem['element_primary_value__validation'], widgetElementItem['element_secondary_value__async_validation']],
                mappingKey: widgetElementItem['request_mapping_key']
            };
            break;
        case 'navigate-link':
            returnObj = {
                ...returnObj,
                gridModalId: widgetElementItem['element_modal_id'],
                gridNavigationRoute: widgetElementItem['navigation_route'],
            };
            break;
        case 'modal-link':
            returnObj = {
                ...returnObj,
                gridModalId: widgetElementItem['element_modal_id'],
                gridSubmitEndpoint: widgetElementItem['submit_endpoint'],
                gridNavigationRoute: widgetElementItem['navigation_route']
            };
            break;
        case 'text':
        case 'text-number':
            returnObj = {
                ...returnObj,
                gridDefaultValue: widgetElementItem['default_value__hover_value'],
                gridDefaultKey: widgetElementItem['default_key__accent_value']
            };
            break;
        case 'color-cell':
            returnObj = {
                ...returnObj,
                gridBgColor: widgetElementItem['default_value__hover_value'],
                gridTextColor: widgetElementItem['default_key__accent_value']
            };
            break;
        case 'btn-link':
            returnObj = {
                ...returnObj,
                iconValue: widgetElementItem['element_icon_value'],
                gridModalId: widgetElementItem['element_modal_id'],
                btnName: widgetElementItem['element_label'],
                gridSubmitEndpoint: widgetElementItem['submit_endpoint'],
                gridNavigationRoute: widgetElementItem['navigation_route']
            };
            break;
    }
    return returnObj;
};

const widgetChartElementCreator = (widgetElementItem) => {
    let widgetElementData = {
        elementColumnId: widgetElementItem['widget_col_count'],
        attributeId: widgetElementItem['role_card_widget_attribute_id'],
        elementType: widgetElementItem['element_type'],
        elementSubType: widgetElementItem['element_subtype'],
        colorKey: widgetElementItem['request_mapping_key'],
        colorValue: widgetElementItem['default_value__hover_value']
    };
    return widgetElementData;
};
const widgetFormElementCreator = (widgetElementItem) => {
    let widgetElementData = {};
    if (objectHasPropertyCheck(widgetElementItem, 'element_type')) {
        widgetElementData = {
            elementColumnId: widgetElementItem['widget_col_count'],
            attributeId: widgetElementItem['role_card_widget_attribute_id'],
            elementType: widgetElementItem['element_type'],
            elementSubType: widgetElementItem['element_subtype'],
            syncValidations: widgetElementItem['element_primary_value__validation'],
            asyncValidations: widgetElementItem['element_secondary_value__async_validation'],
            elementIsEditableFlag: widgetElementItem['is_editable'],
            elementIsDisabledFlag: widgetElementItem['disable_flag'],
            onElementChangeAction: widgetElementItem['element_action_type'],
            formElementWidth: widgetElementItem['attribute_width']
        };
        switch (widgetElementItem['element_type'].toLowerCase()) {
            case 'input':
                widgetElementData = {
                    ...widgetElementData, ...{
                        defaultValue: widgetElementItem['default_value__hover_value'],
                        elementTitle: widgetElementItem['element_title'],
                        requestMappingKey: widgetElementItem['request_mapping_key']
                    }
                };
                break;
            case 'checkbox':
                widgetElementData = {
                    ...widgetElementData, ...{
                        defaultValue: widgetElementItem['default_value__hover_value'],
                        elementTitle: widgetElementItem['element_title'],
                        requestMappingKey: widgetElementItem['request_mapping_key'],
                        elementLabel: widgetElementItem['element_label']
                    }
                };
                break;

            case 'dropdown':
                widgetElementData = {
                    ...widgetElementData, ...{
                        defaultValue: widgetElementItem['default_value__hover_value'],
                        defaultKey: widgetElementItem['default_key__accent_value'],
                        elementTitle: widgetElementItem['element_title'],
                        requestMappingKey: widgetElementItem['request_mapping_key'],
                        dropdownEndpoint: widgetElementItem['dropdown_endpoint'],
                        dropdownReqType: widgetElementItem['dropdown_request_type'],
                        dropdownRequestParams: widgetElementItem['dropdown_request_params'],
                        submitEndpoint: widgetElementItem['submit_endpoint'],
                        submitReqType: widgetElementItem['submit_request_type'],
                        submitRequestParams: widgetElementItem['submit_request_params']
                    }
                };
                break;
            case 'button':
                widgetElementData = {
                    ...widgetElementData, ...{
                        submitReqType: widgetElementItem['submit_request_type'],
                        submitRequestParams: widgetElementItem['submit_request_params'],
                        submitEndpoint: widgetElementItem['submit_endpoint'],
                        elementLabel: widgetElementItem['element_label']
                    }
                };
                break;
            case 'container':
                widgetElementData = {
                    ...widgetElementData, ...{
                        elementTitle: widgetElementItem['element_title'],
                        submitReqType: widgetElementItem['submit_request_type'],
                        submitRequestParams: widgetElementItem['submit_request_params'],
                        submitEndpoint: widgetElementItem['submit_endpoint'],
                        elementLabel: widgetElementItem['element_label'],
                        elementIcon: widgetElementItem['element_icon_value'],
                        elementModalId: widgetElementItem['element_modal_id']
                    }
                };
                break;

            case 'text-link':
            case 'detail-text':
                widgetElementData = {
                    ...widgetElementData, ...{
                        elementLabel: widgetElementItem['element_label']
                    }
                };
                break;
        }
    }
    return widgetElementData;
};
const widgetDetailElementCreator = (widgetElementItem) => {
    let widgetElementData = {
        elementColumnId: widgetElementItem['widget_col_count'],
        attributeId: widgetElementItem['role_card_widget_attribute_id'],
        elementType: widgetElementItem['element_type'],
        elementSubType: widgetElementItem['element_subtype'],
        elementTitle: widgetElementItem['element_title'],
        valueMappingKey: widgetElementItem['request_mapping_key'],
        elementWidth: widgetElementItem['attribute_width']
    };
    switch (widgetElementItem['element_subtype'].toLowerCase()) {
        case 'tile-link':
        case 'link':
            widgetElementData = {
                ...widgetElementData,
                elementChangeAction: widgetElementItem['element_action_type'],
                navigationRoute: widgetElementItem['navigation_route']
            };
            break;
        case 'image-round-tile':
            widgetElementData = {
                ...widgetElementData,
                imageValue: widgetElementItem['default_value__hover_value']
            };
            break;
        case 'role-pill':
            widgetElementData = {
                ...widgetElementData,
                roleValue: widgetElementItem['default_value__hover_value'],
                iconValue: widgetElementItem['element_icon_value']
            };
            break;
        case 'gender-pill':
            widgetElementData = {
                ...widgetElementData,
                genderValue: widgetElementItem['default_value__hover_value'],
                iconValue: widgetElementItem['element_icon_value']
            };
            break;
        case 'tile':
            widgetElementData = {
                ...widgetElementData,
                colorValue: widgetElementItem['default_value__hover_value']
            };
            break;
    }
    return widgetElementData;
};
const widgetMapElementCreator = (widgetElementItem) => {
    let widgetElementData = {};
    switch (widgetElementItem['element_subtype'].toLowerCase()) {
        case 'marker':
            widgetElementData = {
                ...widgetElementData,
                markerMappingKey: widgetElementItem['request_mapping_key']
            };
            break;
        case 'marker-details':
            widgetElementData = {
                ...widgetElementData,
                markerPrimaryDetails: widgetElementItem['default_key__accent_value'],
                markerDetailModalId: widgetElementItem['element_modal_id']
            };
            break;
    }
    return widgetElementData;
};
const getSimCardListBusiness = async (req) => {
    let request = [req.query.userId], response, userDetailResponse, centerIdResponse, centerIdsReq = [], finalResponse,
        modifiedResponse = {gridData: []}, cardIdNameMap = {};

    userDetailResponse = await getUserNameFromUserIdAccessor([req.query.languageId, req.query.userId]);
    if (objectHasPropertyCheck(userDetailResponse, 'rows') && arrayNotEmptyCheck(userDetailResponse.rows)) {
        let nativeUserRole = userDetailResponse.rows[0]['native_user_role'];
        switch (nativeUserRole) {
            case 'ROLE_OPERATOR' : {
                centerIdResponse = await metadataAccessor.getCenterIdsForOperatorAccessor(request);
                break;
            }
            case 'ROLE_SUPERVISOR' : {
                centerIdResponse = await metadataAccessor.getCenterIdsForSupervisorAccessor(request);
                break;
            }
            case 'ROLE_ADMIN' : {
                centerIdResponse = await metadataAccessor.getCenterIdsForAdminAccessor(request);
                break;
            }
            case 'ROLE_SUPER_ADMIN' : {
                centerIdResponse = await metadataAccessor.getCenterIdsForSuperAdminAccessor(request);
                break;
            }
            case 'ROLE_MASTER_ADMIN' : {
                centerIdResponse = await metadataAccessor.getCenterIdsForMasterAdminAccessor(request);
                break;
            }
        }
    }
    if (objectHasPropertyCheck(centerIdResponse, 'rows') && arrayNotEmptyCheck(centerIdResponse.rows)) {
        centerIdResponse.rows.forEach(item => {
            centerIdsReq.push(`${item['location_id']}`);
            cardIdNameMap[item['location_id']] = item['location_name'];
        });
        response = await getSimcardDetailsAccessor(centerIdsReq);
    }

    if (arrayNotEmptyCheck(response)) {
        response.forEach((item) => {
            let simCardObj = {
                simCardId: item['_id'],
                deviceId: item['deviceId'],
                simType: item['simCardType'],
                mobileNo: item['phoneNo'],
                serialNumber: item['serialNp'],
                apn: item['carrierByCountryDetails']['apn'],
                carrierName: item['carrier']['name'],
                center: cardIdNameMap[item['centerId']]
            };
            modifiedResponse.gridData.push(simCardObj);
        });

        finalResponse = fennixResponse(statusCodeConstants.STATUS_OK, 'en', modifiedResponse);
    } else {
        finalResponse = fennixResponse(statusCodeConstants.STATUS_NO_SIMCARDS_FOR_ID, 'en', []);
    }
    return finalResponse;
};

const routeDataModifier = (arrayResponse) => {
    let modifiedRouteObj = {};
    if (arrayNotEmptyCheck(arrayResponse.rows)) {
        arrayResponse.rows.forEach((item) => {
            const parentRouteId = item['parent_route_id'];
            if (objectHasPropertyCheck(item, 'child_route_id') && objectHasPropertyCheck(modifiedRouteObj, parentRouteId)) {
                const childItem = childRouteCreator(item);
                modifiedRouteObj[parentRouteId]['childItems'] = modifiedRouteObj[parentRouteId]['childItems'] || [];
                modifiedRouteObj[parentRouteId]['childItems'].push(childItem);
            } else {
                const parentItem = {
                    itemId: item['parent_route_id'],
                    routeId: item['parent_route_id'],
                    routeModalId: item['parent_route_modal_id'],
                    action: item['parent_action'],
                    icon: item['parent_icon'],
                    position: item['route_position'],
                    routeType: item['parent_route_type'],
                    routeHoverTooltip: item['parent_route_hover_tooltip'],
                    routeOrderId: item['route_order_id'],
                    routeName: item['parent_route_name'],
                    routeUrl: item['parent_route_url'],
                    sideNavOrder: item['sidenav_order_id']
                };
                if (objectHasPropertyCheck(item, 'child_route_id')) {
                    parentItem['childItems'] = [childRouteCreator(item)];
                }
                modifiedRouteObj[parentRouteId] = parentItem;
            }
        });
    }
    return modifiedRouteObj;
};
const childRouteCreator = (item) => {
    const childItem = {
        itemId: item['child_route_id'],
        routeId: item['child_route_id'],
        action: item['child_action'],
        icon: item['child_icon'],
        routeModalId: item['child_route_modal_id'],
        position: item['route_position'],
        routeName: item['child_route_name'],
        routeUrl: item['child_route_url']
    };
    return childItem;
};

const modalCreator = (item, response) => {
    let responseMap = response || {};
    const modalObj = {
        modalElementName: item['modal_element_name'],
        modalId: item['modal_id'],
        modalDataEndpoint: item['data_element'],
        modalSubmitEndpoint: item['submit_endpoint'],
        modalElementAction: item['action_name'],
        modalElementType: item['element_type'],
        modalElementSubType: item['sub_type'],
        modalColId: item['modal_col_count']
    };
    if (objectHasPropertyCheck(responseMap, item['modal_attribute_position'])) {
        responseMap[item['modal_attribute_position']] = responseMap[item['modal_attribute_position']];
    } else {
        responseMap[item['modal_attribute_position']] = {};
    }
    if (objectHasPropertyCheck(responseMap[item['modal_attribute_position']], 'modalSection')) {
        responseMap[item['modal_attribute_position']] = responseMap[item['modal_attribute_position']];
    } else {
        responseMap[item['modal_attribute_position']] = {
            modalPosition: item['modal_attribute_position'],
            modalSection: {}
        };
    }
    if (objectHasPropertyCheck(responseMap[item['modal_attribute_position']]['modalSection'], item['modal_section'])) {
        responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']] = responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']];
    } else {
        responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']] = {
            modalSectionType: item['modal_parent_type'],
            widgetSectionRows: {},
            modalSectionId: item['modal_section']
        };
    }
    if (objectHasPropertyCheck(responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']], 'widgetSectionRows') && objectHasPropertyCheck(responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']]['widgetSectionRows'], item['modal_row_count'])) {
        responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']]['widgetSectionRows'][item['modal_row_count']] = responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']]['widgetSectionRows'][item['modal_row_count']];
    } else {
        responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']]['widgetSectionRows'][item['modal_row_count']] = {
            modalRowId: item['modal_row_count'],
            sectionCols: []
        };
    }
    responseMap[item['modal_attribute_position']]['modalSection'][item['modal_section']]['modalRow'][item['modal_row_count']]['modalCols'].push(modalObj);
    return responseMap;
};
module.exports = {
    getFilterMetadataBusiness,
    getBaseMetadataBusiness,
    getCardMetadataForRouteBusiness,
    getSimCardDetailsBusiness,
    getLoginMetadataBusiness,
    getModelMetadataBusiness,
    getLanguagesListBusiness,
    getRolesBusiness,
    listCentersBusiness,
    getSimCardListBusiness,
    getLanguageListGridBusiness,
    getRolesForRoleIdBusiness,
    getCountryListBusiness,
    dropDownBusiness
};
