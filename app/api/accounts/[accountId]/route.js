import { NextResponse } from "next/server"

import connect from "@/lib/db"
import Account from "@/models/Account"
import { getUserId } from "@/lib/actions"

export const GET = async (request, { params }) => {
    const loginedUserId = await getUserId()

    const { accountId } = params

    let status = null;
    let response = {
        status: false,
        type: null,
        message: null,
        data: null,
    };

    // Fetch
    try {
        await connect()

        const account = await Account.findById(accountId)

        const { title, username, password, remark, userId } = account

        if (userId != loginedUserId) {
            status = 403
            response.status = false
            response.type = "error"
            response.message = "You are not authorized to access this account."
        } else {
            const data = {
                _id: account._id,
                title,
                username,
                password,
                remark,
            }
    
            status = 200
            response.status = true
            response.type = "success"
            response.message = "Account fetched successfully."
            response.data = data
        }
    } catch (err) {
        console.error("Error fetching account record by id:", err);

        status = 500
        response.status = false
        response.type = "error"
        response.message = "Account fetched failed."
    }

    return NextResponse.json(
        response,
        { status }
    )
}

export const DELETE = async (request, { params }) => {
    const { accountId } = params

    let status = null;
    let response = {
        status: false,
        type: null,
        message: null,
        data: null,
    };

    // Fetch
    try {
        await connect()
        await Account.findByIdAndDelete(accountId)

        status = 200
        response.status = true
        response.type = "success"
        response.message = "Account has been deleted."
    } catch (err) {
        console.error("Error deleting account record:", err);

        status = 500
        response.status = false
        response.type = "error"
        response.message = "Account deleted failed."
    }

    return NextResponse.json(
        response,
        { status }
    )
}

export const PUT = async (request, { params }) => {
    const loginedUserId = await getUserId()
    const { accountId } = params

    let status = null;
    let response = {
        status: false,
        type: null,
        message: null,
        data: null,
    };

    const body = await request.json()
    const { title, username, password, remark, userId } = body

    const data = {
        title,
        username,
        password,
        remark,
    }

    // Fetch
    try {
        // From utils/db.js
        await connect()

        if (userId != loginedUserId) {
            status = 403
            response.status = false
            response.type = "error"
            response.message = "You are not authorized to access this account."
        } else {
            await Account.findByIdAndUpdate(accountId, data)
    
            status = 200
            response.status = true
            response.type = "success"
            response.message = "Account has been updated."
        }
    } catch (err) {
        console.error("Error updating account record:", err);

        status = 500
        response.status = false
        response.type = "error"
        response.message = "Account update failed."
    }

    return NextResponse.json(
        response,
        { status }
    )
}