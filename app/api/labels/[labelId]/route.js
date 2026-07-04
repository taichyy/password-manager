import connect from "@/lib/db"
import Label from "@/models/Label"
import { Response } from "@/lib/utils"
import { getUserRole, apiProtect } from "@/lib/actions"

export const DELETE = async (request, props) => {
    // ----- General api check.
    // Auth helpers
    const { getCheckResult } = await apiProtect()
    const valid = await getCheckResult()

    // Response helpers
    const { setStatus, setResponse, getResponse } = Response()

    // Auth check
    if (!valid) {
        setStatus(403)
        setResponse({
            status: false,
            message: "Access denied.",
        })
        return getResponse();
    }

    // Labels are a shared/global taxonomy — only admins may mutate them,
    // matching the admin gate on label creation.
    if ((await getUserRole()) !== "admin") {
        setStatus(403)
        setResponse({
            status: false,
            type: "unauthorized",
            message: "Permission denied.",
        })
        return getResponse();
    }

    const params = await props.params;
    const { labelId } = params

    // Fetch
    try {
        // From utils/db.js
        await connect()
        await Label.findByIdAndDelete(labelId)

        setStatus(200)
        setResponse({
            status: true,
            type: "success",
            message: "Label has been deleted.",
        })
    } catch (err) {
        console.error("Error deleting Label record:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "Label deleted failed.",
        })
    }

    return getResponse();
}

export const PUT = async (request, props) => {
    // ----- General api check.
    // Auth helpers
    const { getCheckResult } = await apiProtect()
    const valid = await getCheckResult()

    // Response helpers
    const { setStatus, setResponse, getResponse } = Response()

    // Auth check
    if (!valid) {
        setStatus(403)
        setResponse({
            status: false,
            message: "Access denied.",
        })
        return getResponse();
    }

    if ((await getUserRole()) !== "admin") {
        setStatus(403)
        setResponse({
            status: false,
            type: "unauthorized",
            message: "Permission denied.",
        })
        return getResponse();
    }

    const params = await props.params;
    const { labelId } = params

    const body = await request.json()
    const { key, name } = body

    const data = {
        key,
        name,
    }

    // Fetch
    try {
        await connect()

        await Label.findByIdAndUpdate(labelId, data)

        setStatus(200)
        setResponse({
            status: true,
            type: "success",
            message: "Label has been updated.",
        })
    } catch (err) {
        console.error("Error updating Label record:", err);

        setStatus(500)
        setResponse({
            status: false,
            type: "error",
            message: "Label update failed.",
        })
    }

    return getResponse();
}