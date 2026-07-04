import connect from "@/lib/db"
import Label from "@/models/Label"
import { Response } from "@/lib/utils"
import { getUserId, getUserRole, apiProtect } from "@/lib/actions"

export const POST = async (request) => {
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

    // POST /api/labels => create a new label
    // POST /api/labels?method=get => get all labels

    // Authoritative identity/role from the DB (not the JWT claim).
    const userId = await getUserId()
    const role = await getUserRole()

    const url = new URL(request.url)
    const method = url.searchParams.get("method")
    // system or custom
    const type = url.searchParams.get("type")

    if (method === "get") {
        // GET /api/labels?method=get => get all labels
        try {
            await connect()

            const labels = await Label.find(type == "custom" ? { userId } : {});

            setStatus(200)
            setResponse({
                status: true,
                type: "success",
                message: "Labels fetched successfully",
                data: labels,
            })
        } catch (error) {
            console.error("Error fetching label records:", error);

            setStatus(500)
            setResponse({
                status: false,
                message: "Label record fetching error.",
            })

            return getResponse();
        }
    } else if ( !method ) {
        if (role !== "admin") {
            setStatus(401)
            setResponse({
                status: false,
                type: "unauthorized",
                message: "Permission denied.",
            })
        } else {
            // POST /api/labels => create a new label
            const body = await request.json()
            const { key, name } = body

            const data = {
                key,
                name,
            }

            const newlabel = new Label(data)

            // Fetch
            try {
                // From utils/db.js
                await connect()

                // Check if label key already exists
                const existingLabel = await Label.findOne({ key })

                if (existingLabel) {
                    setStatus(400)
                    setResponse({
                        status: false,
                        type: "duplicated",
                        message: "Label key already exists.",
                    })
                    return getResponse();
                }

                await newlabel.save()

                setStatus(200)
                setResponse({
                    status: true,
                    type: "success",
                    message: "Label has been created",
                })
            } catch (error) {
                console.error("Error creating label records:", error);

                setStatus(500)
                setResponse({
                    status: false,
                    message: "Label record creating error.",
                })

                return getResponse();
            }
        }
    }

    return getResponse();
}
