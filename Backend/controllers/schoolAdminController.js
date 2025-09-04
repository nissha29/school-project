import School from "../models/School.js";
import User from "../models/Admin.js";
import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import { Role } from "../enum.js";
import { uploadImageFromDataURI } from "../utils/cloudinary.js";
import Admin from "../models/Admin.js";
import PointsHistory from "../models/PointsHistory.js";
import mongoose from "mongoose";
import { reportEmailGenerator } from "../utils/emailHelper.js";
import { generateStudentPDF } from "../utils/generatePDF.js";
import { sendVerifyEmailRoster } from "../services/verificationMail.js";
import { timezoneManager } from "../utils/luxon.js";
import { sendTeacherRegistrationMail } from "../services/verificationMail.js";
import Otp from "../models/Otp.js";
import { sendEmail } from "../services/mail.js";

const getSchoolIdFromUser = async (userId) => {
  // Try finding user as admin first
  const admin = await Admin.findById(userId);
  if (admin) {
    return admin.schoolId;
  }

  // If not admin, try finding as teacher
  const teacher = await Teacher.findById(userId);
  if (teacher) {
    return teacher.schoolId;
  }

  throw new Error("User not authorized");
};

export const addSchool = async (req, res) => {
  const { name, address, district, state, country, timeZone, domain } =
    req.body;
  const logo = req.file;
  try {
    const existingSchool = await School.findOne({ createdBy: req.user.id });
    if (existingSchool) {
      return res
        .status(403)
        .json({ message: "School already exists for this admin." });
    }
    const logoUrl = await uploadImageFromDataURI(logo);
    const newSchool = await School.create({
      name,
      address,
      district,
      logo: logoUrl,
      timeZone,
      createdBy: req.user.id,
      state,
      country,
      domain,
    });

    await User.findByIdAndUpdate(req.user.id, { schoolId: newSchool._id });

    res
      .status(201)
      .json({ message: "School created successfully", school: newSchool });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export const addTeacher = async (req, res) => {
  const { name, password, email, subject, grade, type } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const teacher = await Teacher.create({
      name,
      email,
      password: hashedPassword,
      subject,
      role: Role.Teacher,
      grade,
      type,
    });
    await School.findOneAndUpdate(
      {
        createdBy: req.user.id,
      },
      {
        $push: {
          teachers: teacher._id,
        },
      }
    );
    return res.status(200).json({
      message: "Teacher Added successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const addStudent = async (req, res) => {
  const { name, password, email, standard, grade } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const student = await Student.create({
      name,
      password: hashedPassword,
      standard,
      email,
      role: Role.Student,
      grade,
    });
    await School.findOneAndUpdate(
      {
        createdBy: req.user.id,
      },
      {
        $push: {
          students: student._id,
        },
      }
    );
    return res.status(200).json({
      message: "Student Added successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getStats = async (req, res) => {
  try {
    const id = req.user.id;

    const schoolAdmin = await Admin.findById(id);
    if (!schoolAdmin) {
      return res.status(404).json({ message: "School admin not found" });
    }

    const schoolId = schoolAdmin.schoolId;

    if (schoolId == null) {
      return res.status(200).json({
        totalTeachers: 0,
        totalStudents: 0,
        totalPoints: 0,
        totalWithdrawPoints: 0,
        totalDeductPoints: 0,
        totalFeedbackCount: 0,
      });
    }

    const totalTeachers = await Teacher.countDocuments({ schoolId });
    const totalStudents = await Student.countDocuments({ schoolId });

    // Modified aggregation to separate by form types
    const pointsAggregation = await PointsHistory.aggregate([
      {
        $match: { schoolId },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: "$points" },
          totalWithdrawPoints: {
            $sum: {
              $cond: [{ $eq: ["$formType", "PointWithdraw"] }, "$points", 0],
            },
          },
          totalDeductPoints: {
            $sum: {
              $cond: [{ $eq: ["$formType", "DeductPoints"] }, "$points", 0],
            },
          },
          feedbackCount: {
            $sum: {
              $cond: [{ $eq: ["$formType", "Feedback"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stats = pointsAggregation[0] || {
      totalPoints: 0,
      totalWithdrawPoints: 0,
      totalDeductPoints: 0,
      feedbackCount: 0,
    };

    return res.status(200).json({
      totalTeachers,
      totalStudents,
      totalPoints: stats.totalPoints,
      totalWithdrawPoints: stats.totalWithdrawPoints,
      totalDeductPoints: stats.totalDeductPoints,
      totalFeedbackCount: stats.feedbackCount,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getPointsReceivedPerMonth = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student existence
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Aggregate points received by the student per month
    const pointsData = await PointsHistory.aggregate([
      { $match: { submittedForId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: { $month: "$submittedAt" },
          totalPoints: { $sum: "$points" },
        },
      },
    ]);

    // Create an array of 12 months with default 0 points
    const monthlyPoints = Array(12).fill(0);
    pointsData.forEach((data) => {
      monthlyPoints[data._id - 1] = data.totalPoints; // Month index is 0-based
    });

    return res.status(200).json({ monthlyPoints });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getPointsGivenPerMonth = async (req, res) => {
  try {
    const id = req.user.id; // Get the authenticated user's ID

    // Find the school admin by ID to extract the schoolId
    const schoolAdmin = await Admin.findById(id);
    if (!schoolAdmin) {
      return res.status(404).json({ message: "School admin not found" });
    }

    const schoolId = schoolAdmin.schoolId;

    // Aggregate points given by the teacher per month
    const pointsData = await PointsHistory.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
      {
        $group: {
          _id: { $month: "$submittedAt" },
          totalPoints: { $sum: "$points" },
        },
      },
    ]);

    // Create an array of 12 months with default 0 points
    const monthlyPoints = Array(12).fill(0);
    pointsData.forEach((data) => {
      monthlyPoints[data._id - 1] = data.totalPoints; // Month index is 0-based
    });

    return res.status(200).json({ monthlyPoints });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getPointsGivenPerMonthPerTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Validate teacher existence
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Aggregate points given by the teacher per month
    const pointsData = await PointsHistory.aggregate([
      { $match: { submittedById: new mongoose.Types.ObjectId(teacherId) } },
      {
        $group: {
          _id: { $month: "$submittedAt" },
          totalPoints: { $sum: "$points" },
        },
      },
    ]);

    // Create an array of 12 months with default 0 points
    const monthlyPoints = Array(12).fill(0);
    pointsData.forEach((data) => {
      monthlyPoints[data._id - 1] = data.totalPoints; // Month index is 0-based
    });

    return res.status(200).json({ monthlyPoints });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getFormsSubmittedPerMonth = async (req, res) => {
  try {
    const id = req.user.id; // Get the authenticated user's ID

    // Find the school admin by ID to extract the schoolId
    const schoolAdmin = await Admin.findById(id);
    if (!schoolAdmin) {
      return res.status(404).json({ message: "School admin not found" });
    }

    const schoolId = schoolAdmin.schoolId;
    // Aggregate form submissions by the teacher per month
    const formsData = await PointsHistory.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
      {
        $group: {
          _id: { $month: "$submittedAt" }, // Group by month
          formCount: { $count: {} }, // Count the number of submissions
        },
      },
    ]);

    // Create an array of 12 months with default 0 counts
    const monthlyForms = Array(12).fill(0);
    formsData.forEach((data) => {
      monthlyForms[data._id - 1] = data.formCount; // Month index is 0-based
    });

    return res.status(200).json({ monthlyForms });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getFormsSubmittedPerMonthPerTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Validate teacher existence
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Aggregate form submissions by the teacher per month
    const formsData = await PointsHistory.aggregate([
      { $match: { submittedById: new mongoose.Types.ObjectId(teacherId) } },
      {
        $group: {
          _id: { $month: "$submittedAt" }, // Group by month
          formCount: { $count: {} }, // Count the number of submissions
        },
      },
    ]);

    // Create an array of 12 months with default 0 counts
    const monthlyForms = Array(12).fill(0);
    formsData.forEach((data) => {
      monthlyForms[data._id - 1] = data.formCount; // Month index is 0-based
    });

    return res.status(200).json({ monthlyForms });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const getMonthlyStats = async (req, res) => {
  try {
    const id = req.user.id; // Get the authenticated user's ID

    // Find the school admin by ID to extract the schoolId
    const schoolAdmin = await Admin.findById(id);
    if (!schoolAdmin) {
      return res.status(404).json({ message: "School admin not found" });
    }

    const schoolId = schoolAdmin.schoolId;

    // Calculate monthly stats from the PointHistory model
    const monthlyStats = await PointsHistory.aggregate([
      {
        $match: { schoolId }, // Filter by schoolId
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" }, // Group by year
            month: { $month: "$createdAt" }, // Group by month
          },
          totalPoints: { $sum: "$points" }, // Total points
          totalNegativePoints: {
            $sum: { $cond: [{ $lt: ["$points", 0] }, "$points", 0] }, // Sum only negative points
          },
          feedbackCount: {
            $sum: { $cond: [{ $eq: ["$formType", "Feedback"] }, 1, 0] }, // Count formType as "Feedback"
          },
        },
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 }, // Sort by year and month (descending)
      },
    ]);

    // Format the response
    const formattedMonthlyStats = monthlyStats.map((stat) => ({
      year: stat._id.year,
      month: stat._id.month,
      totalPoints: stat.totalPoints,
      totalNegativePoints: stat.totalNegativePoints,
      feedbackCount: stat.feedbackCount,
    }));

    return res.status(200).json({
      monthlyStats: formattedMonthlyStats,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const sendReport = async (req, res) => {
  try {
    const { email } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileData = {
      buffer: file.buffer,
      originalname: `Etoken Report-${file.originalname}-As_Of_${new Date().toLocaleDateString()}`, // Original name of the file
      mimetype: file.mimetype,
    };

    await reportEmailGenerator(fileData.buffer, fileData.originalname, email);
    return res.status(200).json({ message: "Report sent successfully" });
  } catch (error) {
    console.error("Error in sendReport:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const sendResetOtp = async (req, res) => {
  try {
    const user = await Admin.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const newOtp = new Otp({
      userId: user._id,
      otp: otp,
    });
    await newOtp.save();

    const body = `<p>Use this code to confirm student data reset.  This action will permanently delete all students and their point history data from your school <b>${otp}</b> <br/> <i>The code will expire in 30 min</i></p>`;
    await sendEmail(user.email, "STUDENT DATA RESET OTP", body, body, null);

    return res.status(200).json({
      message: "OTP sent successfully",
      otpId: newOtp._id,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await Admin.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const storedOtp = await Otp.findOne({ otp, userId: user._id });
    if (!storedOtp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (storedOtp.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: storedOtp._id }); // Cleanup expired OTP
      return res.status(400).json({ message: "OTP has expired" });
    }

    await Otp.deleteOne({ _id: storedOtp._id });

    const schoolId = await getSchoolIdFromUser(req.user.id);
    await PointsHistory.deleteMany({
      schoolId,
    });
    await Student.deleteMany({
      schoolId,
    });

    return res
      .status(200)
      .json({ message: "Student roster reset successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const resetStudentRoster = async (req, res) => {
  try {
    const schoolId = await getSchoolIdFromUser(req.user.id);
    await PointsHistory.deleteMany({
      schoolId,
    });
    await Student.deleteMany({
      schoolId,
    });
    return res
      .status(200)
      .json({ message: "Student roster reset successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const genreport = async (req, res) => {
  try {
    const { studentData, schoolData, teacherData } = req.body;

    const email = req.params.email;
    const schData = JSON.parse(schoolData);
    const stdData = JSON.parse(studentData);
    const tchData = JSON.parse(teacherData);
    const barChartImage = req.file.buffer;
    const gen = await generateStudentPDF({
      schoolData: schData,
      studentData: stdData,
      teacherData: tchData,
      barChartImage,
    });

    const timeZone = schData.school.timeZone || "UTC+0";
    const offsetHours = parseInt(timeZone.replace("UTC", "") || "0");

    const utcDate = new Date();

    const localDate = new Date(
      utcDate.getTime() + offsetHours * 60 * 60 * 1000
    );

    const formattedDate = timezoneManager.formatForSchool(
      new Date(),
      timeZone,
      "MMMM dd, yyyy"
    );

    await reportEmailGenerator(
      gen,
      `Etoken Report-${stdData.studentInfo.name}-As Of ${formattedDate}.pdf`,
      email,
      { stdData, schData, tchData }
    );
    if (req.user.role == "SchoolAdmin") {
      await reportEmailGenerator(
        gen,
        `Etoken Report-${stdData.studentInfo.name}-As Of ${formattedDate}.pdf`,
        schData.school.createdBy.email,
        { stdData, schData, tchData }
      );
    }
    return res
      .status(200)
      .json({ message: "Student report sent successfully" });
  } catch (error) {
    console.log(error);

    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const teacherRoster = async (req, res) => {
  try {
    const { teachers } = req.body;
    const user = req.user;
    const schoolId = await getSchoolIdFromUser(user.id);

    const school = await School.findById(schoolId);
    const teacherIds = [...school.teachers];

    if (!teachers || teachers.length === 0) {
      return res.status(400).json({ message: "No teachers provided" });
    }

    // Process all teachers in parallel
    const results = await Promise.all(
      teachers.map(async (teacher) => {
        try {
          // Generate registration token
          const registrationToken =
            Math.random().toString(36).substr(2) + Date.now().toString(36);

          const createdTeacher = await Teacher.create({
            email: teacher.email,
            recieveMails: teacher.recieveMails || false,
            role: Role.Teacher,
            schoolId: schoolId,
            type: teacher.type,
            grade: teacher.grade,
            registrationToken,
            isEmailVerified: false,
            isFirstLogin: false,
            // name: teacher.name, // Not used in new structure
            // subject: teacher.subject, // Not used in new structure
            // firstName: teacher.firstName, // Not used in new structure
            // lastName: teacher.lastName, // Not used in new structure
            // dateOfBirth: teacher.dateOfBirth, // Not used in new structure
          });

          teacherIds.push(createdTeacher._id);
          await sendTeacherRegistrationMail({
            email: createdTeacher.email,
            url: `${process.env.FRONTEND_URL}/teacher/complete-registration`,
            registrationToken,
            schoolLogo: school?.logo,
          });

          return {
            email: createdTeacher.email,
            success: true,
            id: createdTeacher._id,
          };
        } catch (err) {
          return { email: teacher.email, success: false, error: err.message };
        }
      })
    );

    school.teachers = [...new Set(teacherIds)];
    await school.save();

    return res.status(200).json({
      message: "Teacher roster processed",
      results, // Array of {email, success, id/error}
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

export const studentRoster = async (req, res) => {
  try {
    const { students, url } = req.body;
    const user = req.user;
    const schoolId = await getSchoolIdFromUser(user.id);

    const school = await School.findById(schoolId);
    const studentIds = [...school.students];

    if (!students || students.length === 0) {
      return res.status(400).json({ message: "No students provided" });
    }

    // Process each student in parallel
    const createPromises = students.map(async (student) => {
      try {
        if (
          !student.name ||
          !student.email ||
          !student.grade ||
          !student.studentNumber
        ) {
          return null; // Skip invalid student data
        }

        //kept the password as 123456 for now, field might be used in future
        const hashedPassword = await bcrypt.hash("123456", 12);

        const studentData = {
          name: student.name,
          email: student.studentNumber + school.domain,
          grade: student.grade,
          studentNumber: student.studentNumber,
          parentEmail: student.guardian1.email,
          standard: student.guardian2?.email ?? "",
          guardian1: {
            name: student.guardian1.name,
            email: student.guardian1.email,
          },
          guardian2: student.guardian2
            ? {
                name: student.guardian2.name,
                email: student.guardian2.email,
              }
            : null,
          schoolId: schoolId,
          password: hashedPassword,
          role: Role.Student,
          isEmailVerified: false,
          isParentOneEmailVerified: false,
          isParentTwoEmailVerified: false,
          sendNotifications: true,
        };

        const createdStudent = await Student.create(studentData);

        // Send verification emails
        if (student.email) {
          await sendVerifyEmailRoster(
            req,
            res,
            createdStudent,
            true,
            null,
            school.logo
          );
        }

        if (student.guardian1?.email) {
          await sendVerifyEmailRoster(
            req,
            res,
            createdStudent,
            false,
            null,
            school.logo
          );
        }
        return createdStudent._id;
      } catch (error) {
        console.error(`Error creating student ${student.name}:`, error);
        return null;
      }
    });

    // Wait for all students to be created
    const newStudentIds = await Promise.all(createPromises);

    // Filter out any null values (failed creations) and add to school's student list
    const validStudentIds = newStudentIds.filter((id) => id !== null);
    school.students = [...new Set([...studentIds, ...validStudentIds])];
    await school.save();

    return res.status(200).json({
      success: true,
      message: "Student roster updated successfully",
      studentsAdded: validStudentIds.length,
    });
  } catch (error) {
    console.error("Student Roster Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
