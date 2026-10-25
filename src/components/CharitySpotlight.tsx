import Image from "next/image";
import styles from "./CharitySpotlight.module.css";

const charities = [
	{
		name: "ALS Cure Project",
		url: "https://www.ALSCure.org",
		logo: "/charities/als-cure-project.svg",
	},
	{
		name: "LiveLikeLou",
		url: "https://www.livelikelou.org",
		logo: "/charities/livelikelou.svg",
	},
	{
		name: "Project ALS",
		url: "https://www.projectals.org",
		logo: "/charities/project-als.svg",
	},
];

export default function CharitySpotlight() {
	return (
		<section className={styles.spotlight}>
			<div className={styles.container}>
				<h2 className={styles.heading}>Supporting ALS Research & Awareness</h2>
				<div className={styles.logos}>
					{charities.map((charity) => (
						<a
							key={charity.name}
							href={charity.url}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.logoLink}
							aria-label={`Visit ${charity.name} website`}
						>
							<Image
								src={charity.logo}
								alt={charity.name}
								width={200}
								height={80}
								className={styles.logo}
							/>
						</a>
					))}
				</div>
			</div>
		</section>
	);
}
