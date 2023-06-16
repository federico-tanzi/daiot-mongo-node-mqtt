const register = (router) => {
    router.get("/status", (req, resp) => resp.json({ status: 200 }));

    return router;
};

module.exports = {
    register
};
