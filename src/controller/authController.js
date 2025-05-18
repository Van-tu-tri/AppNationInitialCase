const {PrismaClient} = require(`@prisma/client`);
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


async function createUser(username, plainPassword, role = 'user') {
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  return prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role,
    },
  });
}


const register = async(req, res) => {
    const {username, password, role} = req.body;
    
    try {
        const newUser = await createUser(username, password, role);
        return res.status(201).json({ message: "User registered.", userId: newUser.id, username: newUser.username});

    } catch (error) {
        if (error.code === "P2002") {
            return res.status(400).json({message: "Username is already taken."});
        }

        return res.status(500).json({message: "Something went wrong while registering.", error: error.message});
    }
};

const login = async(req, res) => {
    try {
        const {username, password} = req.body;
        const user = await prisma.user.findUnique({ where: { username }, });

        if (!user) 
            return res.status(404).json({message: "User not found.", user: username});

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect)
            return res.status(400).json({message: "Invalid credentails.", user: username});

        const token = jwt.sign({id: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn: "1h"});
        return res.status(200).json({ token });

    } catch (error){
        return res.status(500).json({message: "Something went wrong while login process.", error: error.message});
    }

};
    

module.exports = {
    register, 
    login,
};