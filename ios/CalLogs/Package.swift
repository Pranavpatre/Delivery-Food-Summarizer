// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CalLogs",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "CalLogs",
            targets: ["CalLogs"]),
    ],
    dependencies: [
        .package(url: "https://github.com/google/GoogleSignIn-iOS", from: "7.0.0"),
    ],
    targets: [
        .target(
            name: "CalLogs",
            dependencies: [
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
                .product(name: "GoogleSignInSwift", package: "GoogleSignIn-iOS"),
            ],
            path: "CalLogs"
        ),
    ]
)
