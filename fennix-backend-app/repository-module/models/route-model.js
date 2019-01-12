const mongoose = require('mongoose');
require('mongoose-double')(mongoose);
const Schema = mongoose.Schema;
let SchemaType = mongoose.Schema.Types;

const addressSchema = {
    lat: SchemaType.Double,
    lng: SchemaType.Double,
    name: String
};

const stoppagePointSchema = {
    lat: SchemaType.Double,
    lng: SchemaType.Double,
    name: String,
    timeDuration: SchemaType.Double,
    timeUnit: String
};
const routeSchema = {
    startAddress: addressSchema,
    endAddress: addressSchema,
    wayPoints: [addressSchema],
    stoppagePoints: [stoppagePointSchema],
    totalDistance: Number
};
const companyRoutesCounterSchema = new Schema({
    _id: Schema.Types.ObjectId,
    counter: Number
});

const companyRoutesSchema = new Schema({
    routeId: Number,
    companyId: Number,
    route: routeSchema,
    isActive: Boolean,
    createdBy: Number,
    creationDate: Date,
    updatedBy: Number,
    updatedDate: Date
});

const companyPrimaryAddressSchema = new Schema({
    companyId: Number,
    companyAddress: addressSchema,
    primaryWarehouseAddress: addressSchema,
    primaryPortAddress: addressSchema,
    isActive: Boolean,
    createdBy: Number,
    creationDate: Date,
    updatedBy: Number,
    updatedDate: Date
});

const CompanyPrimaryAddressModel = mongoose.model('companyPrimaryAddressSchema', companyPrimaryAddressSchema, 'companyPrimaryAddress');
const CompanyRouteCounterModel = mongoose.model('companyRouteCounterSchema', companyRoutesCounterSchema, 'companyRouteCounter');
const CompanyRouteModel = mongoose.model('companyRouteSchema', companyRoutesSchema, 'companyRoute');
module.exports = {
    CompanyRouteModel,
    CompanyPrimaryAddressModel,
    CompanyRouteCounterModel
};