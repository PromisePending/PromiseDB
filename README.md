# PromiseDB

Is a Typescript ORM for automatic creation and management of models and entries from simple objects and arrays.
It is designed to be used with any database, but it is currently only implemented for MariaDB/MySQL.

## Installation

```bash
npm install promisedb
```

## Usage

```typescript
import { DatabaseManager, MariaDBConnection, BaseModel, EDatabaseTypes } from 'promisedb';
// const { DatabaseManager, MariaDBConnection, BaseModel, EDatabaseTypes } = require('promisedb');

// if you're only going to have a single connection you may pass it as parameter in DatabaseManager constructor and it will automaticly register it under the name 'default'
const dbmgr = new DatabaseManager();
const mariadb = new MariaDBConnection('localhost', 3306, 'username', 'password', 'database');
dbmgr.registerConnection('prodmaria', mariadb);


// You can also extends BaseModel in a class and pass the params to super() if you wish to instatiate your models all a once somewhere else.
const iceCreamModel = new BaseModel({
    flavor: {
        type: EDatabaseTypes.STRING,
        maxSize: 50, // 50 characters string
        nullable: false,
        unique: true,
        primaryKey: true,
    },
    price: {
        type: EDatabaseTypes.DECIMAL,
        maxSize: 2.2, // Precision of 2 decimal places
        minSize: 2, // $0.00
        nullable: false,
    },
});

// Optionally, you can use the MariaDBConnection instance object instead of calling get connection.
const iceModel = dbmgr.getConnection('prodmaria').registerModel('icecream', iceCreamModel);
iceModel.create({
    flavor: 'chocolate',
    price: 9.99,
}).then(async () => {
    console.log('Sucessfully created item on database!');

    console.log(await iceModel.findOne({ flavor: 'chocolate' }));
});
```
