const mongoose = require('mongoose');
const Schema = mongoose.Schema;
require('mongoose-double')(mongoose);
let SchemaType = mongoose.Schema.Types;
const jwt = require('jsonwebtoken');// This method is used to implement the auth token to be ping ponged back and forth for the request authentication.
const {authAgeTypeMap, JWTSecretPass} = require('../../util-module/util-constants/auth-constants');

const UserSessionSchema = new Schema({
    userEmailId: {type: String, required: true, unique: true},
    tokens: [{
        token: String,
        tokenType: {type: String, enum: ['change_password', 'forgot_password', 'login','cookie']},
        _id: SchemaType.ObjectId,
        ipAddress: String,
        tokenCreationDate: {type: Number, default: new Date().getTime()},
        isExpiryFlag: {type: Boolean, default: true},
        tokenExpiredDate: Number,
        tokenExpiryDate: Number
    }]
});


UserSessionSchema.statics.findUserByEmail = async function (emailId) {
    let userSession = await UserSessionModel.findOne({userEmailId: emailId});
    if (!userSession) {
        userSession = new UserSessionModel({
            userEmailId: emailId,
            tokens: []
        });
        await userSession.save();
    }
    return userSession;
};

UserSessionSchema.methods.generateAuthToken = async function (userObj, authType, ip) {
    const user = this;
    const date = new Date();
    const tokenObj = createTokenObject(userObj, authType, ip);
    if (user) {
        user.tokens.forEach((item) => {
            if (item.tokenType === authType && !item.isExpiryFlag) {
                item.isExpiryFlag = true;
                item.tokenExpiredDate = date.getTime();
            }
        });
        user.tokens = user.tokens.concat([tokenObj]);
        user.save();
    } else {
        const newUser = new UserSessionModel({
            userEmailId: userObj.email_id,
            tokens: [tokenObj]
        });
        await newUser.save();
    }
    return tokenObj.token;
};

const createTokenObject = (userObj, authType, ip) => {
    const date = new Date();
    const newDate = date.setDate(authAgeTypeMap[authType] ? date.getDate() + authAgeTypeMap[authType] : date.getDate());
    const token = jwt.sign(userObj, JWTSecretPass);
    return {
        token,
        ipAddress: ip,
        tokenType: authType,
        isExpiryFlag: false,
        tokenExpiryDate: newDate
    }
};

const UserSessionModel = mongoose.model(null, UserSessionSchema, 'UserSessions');
module.exports = {UserSessionModel};
