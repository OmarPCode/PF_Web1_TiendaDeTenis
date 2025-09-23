const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    wishlist: [String],
    cart: [
        {
            id: String,
            size: String,
            quantity: Number,
            category: String
        }
    ]
});



// Método para verificar la contraseña, usando async/await en lugar de callback
userSchema.methods.isCorrectPassword = async function(password) {
    try {
        // Utilizamos bcrypt.compare para comparar la contraseña
        return await bcrypt.compare(password, this.password);
    } catch (err) {
        throw new Error('Error al comparar la contraseña');
    }
};



const User = mongoose.model('User', userSchema);

module.exports = User;
