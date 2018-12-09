const mysql2 = require('mysql2');
const db = require('mysql-promise')();

class SQLService {
    constructor(configuration) {
        console.log('========== STARTING SQL CONNECTOR =========');
        if (!configuration) {
            console.log('No database configuration found! Aborting...');
        }
        console.log(`Host: ${configuration.host}`);
        console.log(`User: ${configuration.user}`);
        console.log(`Password: ${configuration.password}`);
        console.log(`Database: ${configuration.database}`);
        this.configuration = configuration;
        this.connect = this.connect.bind(this);
        this.query = this.query.bind(this);

        this.connect();
    }

    connect() {
        db.configure({
            host: this.configuration.host,
            user: this.configuration.user,
            password: this.configuration.password,
            database: this.configuration.database
        , mysql2});

        console.log('Testing connection...');
        db.getConnection().then((con) => {
            console.log('Established connection successfully!');
        }).catch((err) => {
            console.log('Could not establish database connection!');
            throw err;
        });
    }
    /**
     * Run DB query. The db library handles the connection state.
     * @param  {String} query
     * @param  {Object} [params]
     * @return {Promise}
     *
     * Example:
     * 			db.query('INSERT INTO links_short (link) VALUES (?)', [part])
     *               .then(function (res) {
	 *				    res.affectedRows.should.equal(1);
	 *				    return db.query('SELECT * FROM links_short');
	 *			    })
     *               .then(function (rows) {
     *					rows.should.have.a.lengthOf(1);
     *					rows[0].id.should.equal(1);
     *					rows[0].foobar.should.equal('monkey');
     *					done();
	 *	    		})
     */
    query(query, params) {
        return db.query(query, params);
    }
}

export default SQLService;