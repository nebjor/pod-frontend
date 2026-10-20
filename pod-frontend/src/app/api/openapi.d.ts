/**
 * Generated from target/openapi.json of the cad-slicer-engine backend by scripts/generate-api-types.mjs.
 * Do not edit by hand; run `npm run api:types` against a running backend instead.
 */
export interface paths {
    "/api/admin/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/erase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["erase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/model": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["model"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["setStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/rate-limits/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["resetRateLimit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["placeOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["find"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["settings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/payments/mock/{sessionId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["quoteUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/sample": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["quoteSample"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AdminOrderResponse: {
            allowedTransitions: ("NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED")[];
            city: string;
            colorCode: string;
            colorLabel: string;
            country: string;
            /** Format: date-time */
            createdAt: string;
            customerEmail: string;
            customerName: string;
            /** Format: date-time */
            deleteAfter: string | null;
            /** Format: date-time */
            erasedAt: string | null;
            filament: string;
            fileName: string;
            /** Format: int64 */
            fileSizeBytes: number;
            layerHeightMm: number;
            machineProfile: string;
            orderNumber: string;
            /** Format: date-time */
            paidAt: string | null;
            paymentProvider: string | null;
            /** Format: int32 */
            plateCount: number;
            postalCode: string;
            quality: string;
            /** Format: int32 */
            quantity: number;
            /** Format: date-time */
            quoteExpiresAt: string;
            /** Format: date-time */
            shippedAt: string | null;
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            street: string;
            totalFilamentGrams: number;
            /** Format: int32 */
            totalPrintTimeSeconds: number;
            totals: components["schemas"]["OrderTotals"];
        };
        BoundingBox: {
            /** Format: double */
            depthMm: number;
            /** Format: double */
            heightMm: number;
            /** Format: double */
            widthMm: number;
        };
        ColorOption: {
            code: string;
            hex: string;
            label: string;
        };
        FilamentOption: {
            code: string;
            colors: components["schemas"]["ColorOption"][];
            label: string;
            profileName: string;
        };
        OrderRequest: {
            city: string;
            color?: string;
            country: string;
            customerName: string;
            /** Format: email */
            email: string;
            expectedTotalChf?: number;
            filament: string;
            postalCode: string;
            quality: string;
            /** Format: int32 */
            quantity?: number;
            street: string;
        };
        OrderResponse: {
            colorCode: string;
            colorLabel: string;
            /** Format: date-time */
            createdAt: string;
            customerEmail: string;
            customerName: string;
            filament: string;
            fileName: string;
            orderNumber: string;
            /** Format: date-time */
            paidAt: string | null;
            paymentUrl: string | null;
            /** Format: int32 */
            plateCount: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            /** Format: date-time */
            quoteExpiresAt: string;
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            totalFilamentGrams: number;
            /** Format: int32 */
            totalPrintTimeSeconds: number;
            totals: components["schemas"]["OrderTotals"];
            vatNote: string | null;
        };
        OrderSettingsResponse: {
            currency: string;
            /** Format: int32 */
            quoteValidityDays: number;
            shippingFlatChf: number;
            shipToCountries: string[];
            vatEnabled: boolean;
            vatRate: number;
        };
        OrderTotals: {
            currency: string;
            itemsTotal: number;
            setupFee: number;
            shipping: number;
            total: number;
            unitPrice: number;
            vatAmount: number;
            vatRate: number;
        };
        QualityOption: {
            /** Format: int32 */
            baseLeadTimeDays: number;
            code: string;
            label: string;
            /** Format: double */
            layerHeightMm: number;
            profileName: string;
        };
        QuoteOptions: {
            filaments: components["schemas"]["FilamentOption"][];
            /** Format: int32 */
            maxQuantity: number;
            qualities: components["schemas"]["QualityOption"][];
        };
        QuoteResponse: {
            boundingBoxMm: components["schemas"]["BoundingBox"];
            color: components["schemas"]["ColorOption"];
            currency: string;
            filament: string;
            /** Format: double */
            filamentGrams: number;
            /** Format: double */
            filamentLengthMm: number;
            fileName: string;
            /** Format: double */
            layerHeightMm: number;
            /** Format: int32 */
            leadTimeDays: number;
            /** Format: double */
            machineCostChf: number;
            machineProfile: string;
            /** Format: double */
            materialCostChf: number;
            /** Format: int32 */
            plateCount: number;
            /** Format: double */
            printTimeSeconds: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            /** Format: double */
            setupFeeChf: number;
            /** Format: double */
            totalFilamentGrams: number;
            /** Format: double */
            totalPriceChf: number;
            /** Format: double */
            totalPrintTimeSeconds: number;
            /** Format: int32 */
            triangleCount: number;
            /** Format: double */
            unitPriceChf: number;
        };
        StatusChange: {
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
        };
        UploadedModel: {
            fileName: string;
            modelId: string;
            /** Format: int64 */
            sizeBytes: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    list: {
        parameters: {
            query?: {
                limit?: number;
                status?: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"][];
                };
            };
        };
    };
    get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    erase: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    model: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    setStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StatusChange"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    resetRateLimit: {
        parameters: {
            query?: {
                clientKey?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    upload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["UploadedModel"];
                };
            };
        };
    };
    placeOrder: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                    request?: components["schemas"]["OrderRequest"];
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderResponse"];
                };
            };
        };
    };
    find: {
        parameters: {
            query: {
                email: string;
            };
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderResponse"];
                };
            };
        };
    };
    settings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderSettingsResponse"];
                };
            };
        };
    };
    complete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    quoteUpload: {
        parameters: {
            query?: {
                color?: string;
                filament?: string;
                modelId?: string;
                quality?: string;
                quantity?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["QuoteResponse"];
                };
            };
        };
    };
    options: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["QuoteOptions"];
                };
            };
        };
    };
    quoteSample: {
        parameters: {
            query: {
                color?: string;
                filament?: string;
                fileName: string;
                quality?: string;
                quantity?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["QuoteResponse"];
                };
            };
        };
    };
}
